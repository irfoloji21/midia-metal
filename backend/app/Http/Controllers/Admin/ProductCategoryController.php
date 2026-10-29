<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ProductCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProductCategoryController extends Controller
{
    public function index()
    {
        return response()->json(ProductCategory::withCount('products')->orderBy('order')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'image' => 'nullable|string',
            'description' => 'nullable|string',
            'active' => 'boolean',
            'order' => 'integer',
        ]);
        $validated['slug'] = Str::slug($validated['name']);
        if ($validated['slug'] === '') {
            throw ValidationException::withMessages(['name' => ['Please enter a category name containing letters or numbers.']]);
        }
        if (ProductCategory::where('slug', $validated['slug'])->exists()) {
            throw ValidationException::withMessages(['name' => ['A category with this name already exists. Please choose a different name.']]);
        }

        return response()->json(ProductCategory::create($validated), 201);
    }

    public function show(ProductCategory $productCategory)
    {
        return response()->json($productCategory->load('products'));
    }

    public function update(Request $request, ProductCategory $productCategory)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'image' => 'nullable|string',
            'description' => 'nullable|string',
            'active' => 'boolean',
            'order' => 'integer',
        ]);
        $productCategory->update($validated);

        return response()->json($productCategory);
    }

    public function destroy(ProductCategory $productCategory)
    {
        $productCategory->delete();

        return response()->json(['message' => 'Category deleted']);
    }
}
