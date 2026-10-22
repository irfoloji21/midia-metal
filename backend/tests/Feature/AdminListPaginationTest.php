<?php

namespace Tests\Feature;

use App\Models\AdminUser;
use App\Models\ContactMessage;
use App\Models\Customer;
use App\Models\PortfolioCategory;
use App\Models\PortfolioProject;
use App\Models\Service;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminListPaginationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs(AdminUser::factory()->create(), 'sanctum');
    }

    public function test_all_four_lists_expose_every_record_and_search_beyond_the_first_page(): void
    {
        foreach (['messages' => ContactMessage::class, 'services' => Service::class, 'portfolio' => PortfolioProject::class, 'customers' => Customer::class] as $endpoint => $model) {
            for ($i = 0; $i < 32; $i++) {
                $name = $i === 31 ? 'Needle Last' : "Record {$i}";
                $fields = match ($endpoint) {
                    'messages' => ['name' => $name, 'email' => "message{$i}@example.com", 'message' => 'Test'],
                    'customers' => ['name' => $name, 'email' => "customer{$i}@example.com", 'password' => 'Password123!'],
                    default => ['title' => $name, 'slug' => "record-{$i}", 'image' => '/placeholder.svg', 'order' => $i],
                };
                $record = $model::create($fields);
                if ($i === 31) {
                    $record->forceFill(['created_at' => '2000-01-01 00:00:00'])->save();
                }
            }
            $ids = [];
            for ($page = 1; $page <= 3; $page++) {
                $response = $this->getJson("/api/admin/{$endpoint}?page={$page}")->assertOk()->assertJsonPath('total', 32);
                $rows = $response->json('data');
                $this->assertCount($page === 3 ? 2 : 15, $rows);
                $ids = array_merge($ids, array_column($rows, 'id'));
                if ($page === 1) {
                    $this->assertNotContains('Needle Last', array_column($rows, in_array($endpoint, ['services', 'portfolio']) ? 'title' : 'name'));
                }
            }
            $this->assertCount(32, array_unique($ids));
            $this->getJson("/api/admin/{$endpoint}?search=Needle")->assertOk()->assertJsonPath('total', 1);
        }
    }

    public function test_message_reason_search_combines_with_read_and_type_filters(): void
    {
        ContactMessage::create(['name' => 'Customer', 'email' => 'test@example.com', 'message' => 'Test', 'reason' => 'Special reason', 'read' => false, 'message_type' => 'order_request']);
        $this->getJson('/api/admin/messages?search=Special&read=0&message_type=order_request')->assertOk()->assertJsonPath('total', 1);
        $this->getJson('/api/admin/messages?search=Special&read=1')->assertOk()->assertJsonPath('total', 0);
        $this->getJson('/api/admin/messages?search=Special&message_type=contact')->assertOk()->assertJsonPath('total', 0);
    }

    public function test_portfolio_client_search_respects_category_filter(): void
    {
        $category = PortfolioCategory::create(['name' => 'Kitchen', 'slug' => 'kitchen']);
        PortfolioProject::create(['title' => 'Project', 'slug' => 'project', 'image' => '/placeholder.svg', 'client' => 'Needle Client', 'customer_number' => '07123456789', 'portfolio_category_id' => $category->id]);
        $this->getJson('/api/admin/portfolio?search=Needle&category_id='.$category->id)->assertOk()->assertJsonPath('total', 1);
        $this->getJson('/api/admin/portfolio?search=Needle&category_id=999')->assertOk()->assertJsonPath('total', 0);
        $this->getJson('/api/admin/portfolio?search=07123456789')->assertOk()->assertJsonPath('total', 1);
    }
}
