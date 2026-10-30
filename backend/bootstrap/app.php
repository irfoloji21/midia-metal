<?php

use App\Http\Middleware\EnsureAdminUser;
use App\Http\Middleware\EnsureCustomerUser;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\UseAdminTokenCookie;
use App\Http\Middleware\UseCustomerTokenCookie;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->encryptCookies(except: [
            'admin_token',
            'customer_token',
        ]);
        $middleware->prependToGroup('api', [
            UseAdminTokenCookie::class,
            UseCustomerTokenCookie::class,
        ]);
        $middleware->redirectGuestsTo(function (Request $request) {
            return $request->expectsJson() || $request->is('api/*')
                ? null
                : '/login';
        });
        $middleware->append(SecurityHeaders::class);
        $middleware->alias([
            'admin.cookie' => UseAdminTokenCookie::class,
            'customer.cookie' => UseCustomerTokenCookie::class,
            'admin.only' => EnsureAdminUser::class,
            'customer.only' => EnsureCustomerUser::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (Request $request, Throwable $exception) => $request->is('api/*') || $request->expectsJson()
        );
    })->create();
