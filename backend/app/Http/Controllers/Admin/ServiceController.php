<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Service;
use App\Services\FrontendContentDeployTrigger;
use App\Support\HtmlSanitizer;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ServiceController extends Controller
{
    public function index(Request $request)
    {
        $query = Service::query();
        if ($request->search) {
            $query->where('title', 'like', "%{$request->search}%");
        }

        return response()->json($query->orderBy('order')->orderBy('id')->paginate(15));
    }

    public function store(Request $request, FrontendContentDeployTrigger $frontendContentDeployTrigger)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'icon' => 'nullable|string',
            'image' => 'nullable|string',
            'excerpt' => 'nullable|string',
            'content' => 'nullable|string',
            'features' => 'nullable|array',
            'active' => 'boolean',
            'order' => 'integer',
        ]);
        $validated['content'] = HtmlSanitizer::richText($validated['content'] ?? null);
        $validated['slug'] = Str::slug($validated['title']).'-'.Str::random(4);

        $service = Service::create($validated);

        if ($service->active) {
            $frontendContentDeployTrigger->trigger('service.created', [
                'id' => $service->id,
                'slug' => $service->slug,
            ]);
        }

        return response()->json($service, 201);
    }

    public function show(Service $service)
    {
        return response()->json($service);
    }

    public function update(Request $request, Service $service, FrontendContentDeployTrigger $frontendContentDeployTrigger)
    {
        $wasPublic = $service->active;
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'icon' => 'nullable|string',
            'image' => 'nullable|string',
            'excerpt' => 'nullable|string',
            'content' => 'nullable|string',
            'features' => 'nullable|array',
            'active' => 'boolean',
            'order' => 'integer',
        ]);
        $validated['content'] = HtmlSanitizer::richText($validated['content'] ?? null);
        $service->update($validated);

        if ($wasPublic || $service->active) {
            $frontendContentDeployTrigger->trigger('service.updated', [
                'id' => $service->id,
                'slug' => $service->slug,
            ]);
        }

        return response()->json($service);
    }

    public function destroy(Service $service, FrontendContentDeployTrigger $frontendContentDeployTrigger)
    {
        $wasPublic = $service->active;
        $serviceId = $service->id;
        $serviceSlug = $service->slug;
        $service->delete();

        if ($wasPublic) {
            $frontendContentDeployTrigger->trigger('service.deleted', [
                'id' => $serviceId,
                'slug' => $serviceSlug,
            ]);
        }

        return response()->json(['message' => 'Service deleted']);
    }
}
