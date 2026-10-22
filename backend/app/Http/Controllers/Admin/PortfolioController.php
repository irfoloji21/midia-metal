<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PortfolioCategory;
use App\Models\PortfolioProject;
use App\Services\FrontendContentDeployTrigger;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PortfolioController extends Controller
{
    public function index(Request $request)
    {
        $query = PortfolioProject::with('portfolioCategory');
        if ($request->search) {
            $query->where(function ($searchQuery) use ($request) {
                $searchQuery->where('title', 'like', "%{$request->search}%")
                    ->orWhere('client', 'like', "%{$request->search}%")
                    ->orWhere('customer_number', 'like', "%{$request->search}%");
            });
        }
        if ($request->category_id) {
            $query->where('portfolio_category_id', $request->category_id);
        }

        return response()->json($query->orderBy('order')->latest()->orderByDesc('id')->paginate(15));
    }

    public function store(Request $request, FrontendContentDeployTrigger $frontendContentDeployTrigger)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'image' => 'required|string',
            'description' => 'nullable|string',
            'location' => 'nullable|string',
            'client' => 'nullable|string',
            'customer_number' => 'nullable|string|max:255',
            'year' => 'nullable|string',
            'portfolio_category_id' => 'nullable|integer|exists:portfolio_categories,id',
            'services_list' => 'nullable|array',
            'gallery' => 'nullable|array',
            'active' => 'boolean',
            'order' => 'integer',
        ]);
        $validated['slug'] = Str::slug($validated['title']).'-'.Str::random(4);

        $project = PortfolioProject::create($validated)->load('portfolioCategory');

        if ($project->active) {
            $frontendContentDeployTrigger->trigger('portfolio.created', [
                'id' => $project->id,
                'slug' => $project->slug,
            ]);
        }

        return response()->json($project, 201);
    }

    public function show(PortfolioProject $portfolio)
    {
        return response()->json($portfolio->load('portfolioCategory'));
    }

    public function update(Request $request, PortfolioProject $portfolio, FrontendContentDeployTrigger $frontendContentDeployTrigger)
    {
        $wasPublic = $portfolio->active;
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'image' => 'sometimes|required|string',
            'description' => 'nullable|string',
            'location' => 'nullable|string',
            'client' => 'nullable|string',
            'customer_number' => 'nullable|string|max:255',
            'year' => 'nullable|string',
            'portfolio_category_id' => 'nullable|integer|exists:portfolio_categories,id',
            'services_list' => 'nullable|array',
            'gallery' => 'nullable|array',
            'active' => 'boolean',
            'order' => 'integer',
        ]);
        $portfolio->update($validated);

        if ($wasPublic || $portfolio->active) {
            $frontendContentDeployTrigger->trigger('portfolio.updated', [
                'id' => $portfolio->id,
                'slug' => $portfolio->slug,
            ]);
        }

        return response()->json($portfolio->load('portfolioCategory'));
    }

    public function destroy(PortfolioProject $portfolio, FrontendContentDeployTrigger $frontendContentDeployTrigger)
    {
        $wasPublic = $portfolio->active;
        $portfolioId = $portfolio->id;
        $portfolioSlug = $portfolio->slug;
        $portfolio->delete();

        if ($wasPublic) {
            $frontendContentDeployTrigger->trigger('portfolio.deleted', [
                'id' => $portfolioId,
                'slug' => $portfolioSlug,
            ]);
        }

        return response()->json(['message' => 'Project deleted']);
    }

    public function categories()
    {
        return response()->json(PortfolioCategory::withCount('projects')->get());
    }

    public function storeCategory(Request $request, FrontendContentDeployTrigger $frontendContentDeployTrigger)
    {
        $validated = $request->validate(['name' => 'required|string|max:255']);
        $validated['slug'] = Str::slug($validated['name']);

        $category = PortfolioCategory::create($validated);
        $frontendContentDeployTrigger->trigger('portfolio_category.created', [
            'id' => $category->id,
            'slug' => $category->slug,
        ]);

        return response()->json($category, 201);
    }

    public function updateCategory(Request $request, PortfolioCategory $portfolioCategory, FrontendContentDeployTrigger $frontendContentDeployTrigger)
    {
        $validated = $request->validate(['name' => 'required|string|max:255']);
        $validated['slug'] = Str::slug($validated['name']);
        $portfolioCategory->update($validated);

        $frontendContentDeployTrigger->trigger('portfolio_category.updated', [
            'id' => $portfolioCategory->id,
            'slug' => $portfolioCategory->slug,
        ]);

        return response()->json($portfolioCategory);
    }

    public function destroyCategory(PortfolioCategory $portfolioCategory, FrontendContentDeployTrigger $frontendContentDeployTrigger)
    {
        $categoryId = $portfolioCategory->id;
        $categorySlug = $portfolioCategory->slug;
        $portfolioCategory->delete();

        $frontendContentDeployTrigger->trigger('portfolio_category.deleted', [
            'id' => $categoryId,
            'slug' => $categorySlug,
        ]);

        return response()->json(['message' => 'Category deleted']);
    }
}
