<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveBlogPostRequest;
use App\Models\BlogPost;
use App\Services\FrontendContentDeployTrigger;
use App\Support\HtmlSanitizer;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class BlogController extends Controller
{
    public function index(Request $request)
    {
        $query = BlogPost::query();
        if ($request->search) {
            $query->where('title', 'like', "%{$request->search}%");
        }
        if ($request->category) {
            $query->where('category', $request->category);
        }

        return response()->json($query->latest()->orderByDesc('id')->paginate(15));
    }

    public function store(SaveBlogPostRequest $request, FrontendContentDeployTrigger $frontendContentDeployTrigger)
    {
        $validated = $request->validated();
        $validated['content'] = HtmlSanitizer::richText($validated['content'] ?? null);
        $validated['slug'] = Str::slug($validated['title']).'-'.Str::random(4);
        if (empty($validated['published_at'])) {
            $validated['published_at'] = now();
        }

        $post = BlogPost::create($validated);

        if ($post->active) {
            $frontendContentDeployTrigger->trigger('blog.created', [
                'id' => $post->id,
                'slug' => $post->slug,
            ]);
        }

        return response()->json($post, 201);
    }

    public function show(BlogPost $blog)
    {
        return response()->json($blog);
    }

    public function update(SaveBlogPostRequest $request, BlogPost $blog, FrontendContentDeployTrigger $frontendContentDeployTrigger)
    {
        $wasPublic = $blog->active;
        $validated = $request->validated();
        $validated['content'] = HtmlSanitizer::richText($validated['content'] ?? null);
        $blog->update($validated);

        if ($wasPublic || $blog->active) {
            $frontendContentDeployTrigger->trigger('blog.updated', [
                'id' => $blog->id,
                'slug' => $blog->slug,
            ]);
        }

        return response()->json($blog);
    }

    public function destroy(BlogPost $blog, FrontendContentDeployTrigger $frontendContentDeployTrigger)
    {
        $wasPublic = $blog->active;
        $blogId = $blog->id;
        $blogSlug = $blog->slug;
        $blog->delete();

        if ($wasPublic) {
            $frontendContentDeployTrigger->trigger('blog.deleted', [
                'id' => $blogId,
                'slug' => $blogSlug,
            ]);
        }

        return response()->json(['message' => 'Blog post deleted']);
    }
}
