<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ $product->name }} - Product information</title>
    <style>
        @page { margin: 42px 46px 55px; }
        body { font-family: "DejaVu Sans", sans-serif; font-size: 12px; line-height: 1.65; color: #3f4c60; }
        .brand { font-size: 11px; color: #ac410b; letter-spacing: 1.5px; font-weight: bold; }
        h1 { font-size: 28px; line-height: 1.25; color: #10275c; margin: 12px 0; }
        h2 { font-size: 20px; line-height: 1.3; color: #10275c; margin: 26px 0 12px; page-break-after: avoid; }
        h3, h4 { font-size: 15px; line-height: 1.4; color: #10275c; margin: 20px 0 9px; page-break-after: avoid; }
        .word-heading-1 { font-size: 28px; line-height: 1.25; margin: 12px 0; }
        .word-heading-2 { font-size: 20px; line-height: 1.3; margin: 26px 0 12px; }
        .word-heading-3, .word-heading-4 { font-size: 15px; line-height: 1.4; margin: 20px 0 9px; }
        p { margin: 0 0 11px; orphans: 3; widows: 3; }
        a { color: #ac410b; text-decoration: underline; }
        ul, ol { padding-left: 20px; margin: 10px 0 14px; }
        li { margin: 5px 0; }
        .meta { color: #68758a; margin: 0 0 18px; }
        .description-start { border-top: 2px solid #10275c; padding-top: 14px; }
        .product-section { margin-bottom: 20px; }
        .product-eyebrow { margin-top: 18px; color: #ac410b; font-size: 9px; font-weight: bold; page-break-after: avoid; }
        .product-caption { color: #68758a; font-size: 8px; margin: 7px 0 14px; }
        img { display: block; margin: 10px auto; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; margin: 12px 0 18px; }
        thead { display: table-header-group; }
        th, td { text-align: left; vertical-align: top; padding: 8px 10px; border: 1px solid #dbe1e9; overflow-wrap: break-word; }
        th { color: #10275c; background: #eff3f7; font-weight: bold; }
        .specifications th, .product-reference-table th { width: 34%; }
        .product-performance-table table { page-break-inside: avoid; }
        .product-reference-table th, .product-reference-table td { border-width: 0 0 1px; background: white; }
        .image-row { table-layout: fixed; margin: 8px 0 14px; page-break-inside: avoid; }
        .image-row td { border: 0; padding: 4px; vertical-align: middle; text-align: center; }
        .image-row img { margin: 0 auto; }
        .product-note, blockquote { border-left: 3px solid #eb5c10; padding: 10px 14px; background: #f4f6f8; margin: 16px 0; }
        .product-links { margin: 14px 0; }
        .image-unavailable { font-size: 9px; color: #68758a; }
        .document-header { margin: 0 0 10px; page-break-inside: avoid; }
        .document-header td { padding: 0; border: 0; }
        .document-header .qr { width: 132px; text-align: center; padding-left: 18px; font-size: 9px; line-height: 1.4; }
        .qr img { margin: 0 auto 4px; }
        .qr a { display: block; text-decoration: none; }
        .qr .domain { color: #68758a; font-size: 8px; overflow-wrap: break-word; }
        .gallery-title { margin-top: 10px; }
        footer { position: fixed; bottom: -28px; font-size: 8px; color: #68758a; }
    </style>
</head>
<body>
    <footer>Midia M Metal · Product information · {{ \Illuminate\Support\Str::limit($product->product_code ?: $product->name, 55) }}</footer>
    <table class="document-header"><tbody><tr>
        <td>
            <div class="brand">MIDIA M METAL / PRODUCT INFORMATION</div>
            <h1>{{ $product->name }}</h1>
            <div class="meta">
                @if($product->product_code)<strong>Product code:</strong> {{ $product->product_code }}<br>@endif
                @if($product->category)<strong>Category:</strong> {{ $product->category->name }}<br>@endif
                Generated {{ $generatedAt }}
            </div>
        </td>
        <td class="qr">
            <a href="{{ $productUrl }}"><img src="{{ $qrCode }}" width="120" height="120" alt="QR code for this product" /></a>
            <a href="{{ $productUrl }}">View product online</a>
            <div class="domain">{{ $siteDomain }}</div>
        </td>
    </tr></tbody></table>
    @if($gallery)<h3 class="gallery-title">Product images</h3>@endif
    {!! $gallery !!}
    <h2 class="description-start">Product description</h2>
    {!! $description !!}
    @if($variantDetails)
        <h2>Available options</h2>
        <ul>@foreach($variantDetails as $detail)<li>{{ $detail }}</li>@endforeach</ul>
    @endif
</body>
</html>
