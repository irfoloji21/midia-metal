<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BlogPost;
use Illuminate\Http\Request;

class BlogController extends Controller
{
    public function index(Request $request)
    {
        $query = BlogPost::where('active', true);
        $filters = $request->validate([
            'categories' => 'sometimes|array|max:50',
            'categories.*' => 'string|max:255',
            'category' => 'sometimes|nullable|string|max:255',
        ]);
        $categories = $filters['categories'] ?? (! empty($filters['category']) ? [$filters['category']] : []);
        if ($categories) {
            $query->whereIn('category', $categories);
        }
        if ($request->search) {
            $query->where('title', 'like', "%{$request->search}%");
        }

        return response()->json($query->latest('published_at')->orderByDesc('id')->paginate(9));
    }

    public function show($slug)
    {
        $post = BlogPost::where('active', true)
            ->where(fn ($q) => $q->where('slug', $slug)->orWhere('id', $slug))
            ->firstOrFail();

        return response()->json($post);
    }

    public function categories()
    {
        return response()->json(
            BlogPost::where('active', true)
                ->selectRaw('category, count(*) as count')
                ->groupBy('category')
                ->get()
        );
    }

    public function recent()
    {
        return response()->json(BlogPost::where('active', true)->latest('published_at')->orderByDesc('id')->take(3)->get());
    }
}
