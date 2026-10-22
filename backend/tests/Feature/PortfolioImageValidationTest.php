<?php

namespace Tests\Feature;

use App\Models\AdminUser;
use App\Models\PortfolioProject;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PortfolioImageValidationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.frontend_deploy.enabled' => false]);
        $this->actingAs(AdminUser::factory()->create(), 'sanctum');
    }

    public function test_image_is_required_when_creating_a_project(): void
    {
        foreach ([[], ['image' => null], ['image' => ''], ['image' => '   ']] as $image) {
            $this->postJson('/api/admin/portfolio', ['title' => 'Project', ...$image])->assertUnprocessable()->assertJsonValidationErrors('image');
        }
        $this->assertDatabaseCount('portfolio_projects', 0);
        $this->postJson('/api/admin/portfolio', ['title' => 'Project', 'image' => '/placeholder.svg'])->assertCreated();
    }

    public function test_edit_can_keep_an_image_but_cannot_remove_it(): void
    {
        $project = PortfolioProject::create(['title' => 'Project', 'slug' => 'project', 'image' => '/placeholder.svg']);
        foreach ([null, '', '   '] as $image) {
            $this->putJson('/api/admin/portfolio/'.$project->id, ['title' => 'Updated', 'image' => $image])->assertUnprocessable()->assertJsonValidationErrors('image');
        }
        $this->putJson('/api/admin/portfolio/'.$project->id, ['title' => 'Updated'])->assertOk();
        $this->assertSame('/placeholder.svg', $project->fresh()->getRawOriginal('image'));
        $this->putJson('/api/admin/portfolio/'.$project->id, ['title' => 'Updated', 'image' => '/images/new-project.jpg'])->assertOk();
    }
}
