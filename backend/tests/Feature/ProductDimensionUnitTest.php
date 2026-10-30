<?php

namespace Tests\Feature;

use App\Models\AdminUser;
use App\Models\Product;
use App\Models\SiteSetting;
use App\Shipping\ParcelBuilder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\View;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ProductDimensionUnitTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs(AdminUser::factory()->create(), 'sanctum');
        Http::preventStrayRequests();
    }

    private function payload(string $mode = 'legacy'): array
    {
        $variant = [
            'price' => '£25.00', 'stock' => 7,
            'shipping_weight_kg' => 1.5,
            'shipping_length_cm' => 100, 'shipping_width_cm' => 25.13, 'shipping_height_cm' => 10,
            'shipping_class' => 'standard', 'ships_separately' => false,
            'custom_fields' => ['finish_note' => 'Keep this specification'],
        ];
        $variant += $mode === 'combination'
            ? ['attributes' => ['Finish' => 'Brushed']]
            : ['option' => 'Size', 'value' => 'Existing size label'];

        return [
            'name' => 'Dimension unit fixture', 'price' => '£25.00', 'old_price' => '£30.00',
            'image' => '', 'active' => true, 'track_stock' => true, 'stock_quantity' => 7,
            'pdf_download_enabled' => true, 'variant_mode' => $mode,
            'variant_options' => $mode === 'combination' ? ['Finish'] : null,
            'frontend_variant_layout' => $mode === 'combination' ? 'selection_table' : 'default',
            'selection_table_config' => $mode === 'combination'
                ? ['tab_option' => 'Finish', 'intro_text' => 'Keep this layout'] : null,
            'specifications' => ['Material' => 'Steel'], 'tags' => ['fixture'],
            'variants' => [$variant],
            'variant_table_columns' => [
                'size' => [
                    ['key' => 'stock', 'label' => 'Available stock', 'visible' => false, 'frontendVisible' => false],
                    ['key' => 'shipping_length_cm', 'label' => 'Length (cm)', 'visible' => true, 'frontendVisible' => true],
                    ['key' => 'shipping_width_cm', 'label' => 'Width (cm)', 'visible' => true, 'frontendVisible' => true],
                    ['key' => 'shipping_height_cm', 'label' => 'Height (cm)', 'visible' => true, 'frontendVisible' => true],
                ],
                'general' => [],
                'combination' => [
                    ['key' => 'custom:finish_note', 'label' => 'Finish note', 'visible' => true, 'frontendVisible' => true],
                ],
            ],
        ];
    }

    #[DataProvider('unitsAndModes')]
    public function test_unit_persists_through_create_update_reopen_and_duplicate_without_changing_product_or_delivery(
        string $mode,
        string $unit,
        string $nextUnit,
    ): void {
        SiteSetting::create(['key' => 'dimension_audit_sentinel', 'value' => 'unchanged', 'group' => 'test']);
        $settingsBefore = SiteSetting::all()->toArray();
        $payload = $this->payload($mode);
        $payload['variant_table_columns']['dimension_unit'] = $unit;
        $created = $this->postJson('/api/admin/products', $payload)->assertCreated()
            ->assertJsonPath('variant_table_columns.dimension_unit', $unit)
            ->assertJsonPath('variant_table_columns.size.1.label', 'Available stock')
            ->assertJsonPath('variant_table_columns.size.1.visible', false)
            ->assertJsonPath('variant_table_columns.combination.0.key', 'custom:finish_note')
            ->assertJsonPath('variant_table_columns.combination.0.label', 'Finish note');
        $product = Product::findOrFail($created->json('id'));
        $this->getJson('/api/admin/products/'.$product->id)->assertOk()
            ->assertJsonPath('variant_table_columns.dimension_unit', $unit);

        $selection = $mode === 'combination'
            ? ['Finish' => ['option' => 'Finish', 'value' => 'Brushed']]
            : ['Size' => ['option' => 'Size', 'value' => 'Existing size label']];
        $items = [['product_id' => $product->id, 'quantity' => 1, 'selected_variants' => $selection]];
        $deliveryBefore = app(ParcelBuilder::class)->buildForCheckoutItems($items);
        $before = $product->toArray();

        $payload['variant_table_columns']['dimension_unit'] = $nextUnit;
        $this->putJson('/api/admin/products/'.$product->id, $payload)->assertOk()
            ->assertJsonPath('variant_table_columns.dimension_unit', $nextUnit);
        $this->getJson('/api/admin/products/'.$product->id)->assertOk()
            ->assertJsonPath('variant_table_columns.dimension_unit', $nextUnit);
        $public = $this->getJson('/api/v1/products/'.$product->id)->assertOk();
        $this->assertEquals(100, $public->json('variants.0.shipping_length_cm'));
        $this->assertEquals(25.13, $public->json('variants.0.shipping_width_cm'));
        $this->assertEquals(10, $public->json('variants.0.shipping_height_cm'));

        $after = $product->fresh()->toArray();
        unset($before['updated_at'], $after['updated_at']);
        unset($before['variant_table_columns']['dimension_unit'], $after['variant_table_columns']['dimension_unit']);
        $this->assertSame($before, $after, 'Changing the input unit must not alter canonical dimensions, prices, stock, labels or other product settings.');
        $this->assertSame($deliveryBefore, app(ParcelBuilder::class)->buildForCheckoutItems($items));
        $this->assertSame($settingsBefore, SiteSetting::all()->toArray());

        $copy = $this->postJson('/api/admin/products/'.$product->id.'/duplicate')->assertCreated()
            ->assertJsonPath('variant_table_columns.dimension_unit', $nextUnit);
        $duplicate = Product::findOrFail($copy->json('id'));
        $this->assertSame($product->fresh()->variants, $duplicate->variants);
        $this->assertSame($product->fresh()->variant_table_columns, $duplicate->variant_table_columns);
    }

    public static function unitsAndModes(): array
    {
        $cases = [];
        foreach (['legacy', 'combination'] as $mode) {
            foreach (['mm' => 'cm', 'cm' => 'm', 'm' => 'mm'] as $unit => $nextUnit) {
                $cases[$mode.' '.$unit.' to '.$nextUnit] = [$mode, $unit, $nextUnit];
            }
        }

        return $cases;
    }

    #[DataProvider('variantModes')]
    public function test_point_one_millimetre_dimensions_survive_create_update_and_reopen_without_lowering_parcel_safeguards(string $mode): void
    {
        config(['services.shipping.packaging.padding_cm' => 1]);
        $payload = $this->payload($mode);
        $payload['variant_table_columns']['dimension_unit'] = 'mm';
        $dimensions = ['shipping_length_cm', 'shipping_width_cm', 'shipping_height_cm'];
        foreach ($dimensions as $field) {
            $payload[$field] = 0.01;
            $payload['variants'][0][$field] = 0.01;
        }
        $created = $this->postJson('/api/admin/products', $payload)->assertCreated();
        $id = $created->json('id');
        foreach ($dimensions as $field) {
            $this->assertSame(0.01, $created->json($field));
            $this->assertSame(0.01, $created->json('variants.0.'.$field));
        }
        $before = Product::findOrFail($id)->toArray();

        // Replacing an existing larger value must preserve the minimum too.
        foreach ([0.5, 0.01] as $centimetres) {
            foreach ($dimensions as $field) {
                $payload[$field] = $centimetres;
                $payload['variants'][0][$field] = $centimetres;
            }
            $this->putJson('/api/admin/products/'.$id, $payload)->assertOk();
            $reopened = $this->getJson('/api/admin/products/'.$id)->assertOk()
                ->assertJsonPath('variant_table_columns.dimension_unit', 'mm')
                ->assertJsonPath('price', '£25.00')->assertJsonPath('stock_quantity', 7);
            foreach ($dimensions as $field) {
                $this->assertSame($centimetres, $reopened->json($field));
                $this->assertSame($centimetres, $reopened->json('variants.0.'.$field));
            }
        }
        $after = Product::findOrFail($id)->toArray();
        unset($before['updated_at'], $after['updated_at']);
        $this->assertSame($before, $after, 'Dimension edits must not alter prices, stock, labels or other product settings.');

        $selection = $mode === 'combination'
            ? ['Finish' => ['option' => 'Finish', 'value' => 'Brushed']]
            : ['Size' => ['option' => 'Size', 'value' => 'Existing size label']];
        $delivery = app(ParcelBuilder::class)->buildForCheckoutItems([
            ['product_id' => $id, 'quantity' => 1, 'selected_variants' => $selection],
        ]);
        $this->assertCount(1, $delivery['parcels']);
        foreach (['length', 'width', 'height'] as $field) {
            // Carrier packaging still uses a 1cm minimum plus 1cm padding each side.
            $this->assertSame(3.0, $delivery['parcels'][0][$field]);
        }
        foreach ($dimensions as $field) {
            $this->assertSame(0.01, Product::findOrFail($id)->{$field});
        }
    }

    public static function variantModes(): array
    {
        return ['legacy' => ['legacy'], 'combination' => ['combination']];
    }

    #[DataProvider('invalidDimensions')]
    public function test_zero_negative_and_subminimum_dimensions_are_not_stored(string $mode, float $value): void
    {
        $payload = $this->payload($mode);
        $dimensions = ['shipping_length_cm', 'shipping_width_cm', 'shipping_height_cm'];
        foreach ($dimensions as $field) {
            $payload[$field] = $value;
            $payload['variants'][0][$field] = $value;
        }
        $this->postJson('/api/admin/products', $payload)->assertUnprocessable()
            ->assertJsonValidationErrors($dimensions);
        $this->assertDatabaseCount('products', 0);

        // Existing variant normalization treats invalid optional dimensions as absent.
        foreach ($dimensions as $field) {
            unset($payload[$field]);
        }
        $created = $this->postJson('/api/admin/products', $payload)->assertCreated()
            ->assertJsonPath('price', '£25.00')->assertJsonPath('stock_quantity', 7);
        foreach ($dimensions as $field) {
            $created->assertJsonPath('variants.0.'.$field, null);
        }
    }

    public static function invalidDimensions(): array
    {
        $cases = [];
        foreach (['legacy', 'combination'] as $mode) {
            foreach (['zero' => 0.0, 'negative' => -0.01, 'below minimum' => 0.009] as $name => $value) {
                $cases[$mode.' '.$name] = [$mode, $value];
            }
        }

        return $cases;
    }

    public function test_omitted_unit_keeps_the_existing_column_json_shape(): void
    {
        $payload = $this->payload();
        $created = $this->postJson('/api/admin/products', $payload)->assertCreated()
            ->assertJsonMissingPath('variant_table_columns.dimension_unit');
        $this->assertSame(['size', 'general', 'combination'], array_keys($created->json('variant_table_columns')));
        $this->putJson('/api/admin/products/'.$created->json('id'), $payload)->assertOk()
            ->assertJsonMissingPath('variant_table_columns.dimension_unit');
    }

    public function test_empty_and_null_column_configs_keep_their_existing_normalization(): void
    {
        $payload = $this->payload();
        $payload['variant_table_columns'] = [];
        $empty = $this->postJson('/api/admin/products', $payload)->assertCreated()
            ->assertJsonMissingPath('variant_table_columns.dimension_unit');
        $this->assertSame(['size', 'general', 'combination'], array_keys($empty->json('variant_table_columns')));

        $payload['variant_table_columns'] = null;
        $this->putJson('/api/admin/products/'.$empty->json('id'), $payload)->assertOk()
            ->assertJsonPath('variant_table_columns', null);
    }

    #[DataProvider('invalidUnits')]
    public function test_invalid_unit_cannot_create_or_modify_a_product(mixed $unit): void
    {
        $payload = $this->payload();
        $created = $this->postJson('/api/admin/products', $payload)->assertCreated();
        $before = Product::findOrFail($created->json('id'))->toArray();
        $payload['variant_table_columns']['dimension_unit'] = $unit;

        $this->postJson('/api/admin/products', $payload)->assertUnprocessable()
            ->assertJsonValidationErrors('variant_table_columns.dimension_unit');
        $this->putJson('/api/admin/products/'.$created->json('id'), $payload)->assertUnprocessable()
            ->assertJsonValidationErrors('variant_table_columns.dimension_unit');
        $this->assertDatabaseCount('products', 1);
        $this->assertSame($before, Product::findOrFail($created->json('id'))->toArray());
    }

    public static function invalidUnits(): array
    {
        return ['unsupported' => ['inch'], 'null' => [null], 'empty' => [''], 'array' => [[]], 'number' => [1]];
    }

    public function test_real_pdf_ignores_unit_metadata_and_keeps_centimetre_column_values(): void
    {
        $payload = $this->payload();
        $payload['variant_table_columns']['dimension_unit'] = 'mm';
        $payload['variants'][0]['shipping_height_cm'] = 0.01;
        $created = $this->postJson('/api/admin/products', $payload)->assertCreated();
        $details = [];
        View::composer('pdf.product', function ($view) use (&$details) {
            $details = $view->getData()['variantDetails'];
        });

        $response = $this->get('/api/v1/products/'.$created->json('id').'/pdf')->assertOk()
            ->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringStartsWith('%PDF-', $response->getContent());
        $this->assertGreaterThan(5000, strlen($response->getContent()));
        $text = implode("\n", $details);
        $this->assertStringContainsString('Length (cm): 100', $text);
        $this->assertStringContainsString('Width (cm): 25.13', $text);
        $this->assertStringContainsString('Height (cm): 0.01', $text);
        $this->assertStringNotContainsString('dimension_unit', $text);
        Http::assertNothingSent();
    }
}
