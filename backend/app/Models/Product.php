<?php

namespace App\Models;

use App\Models\Concerns\NormalizesMediaUrls;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory, NormalizesMediaUrls;

    protected $fillable = [
        'name',
        'product_code',
        'show_variant_in_title',
        'slug',
        'variant_mode',
        'variant_options',
        'frontend_variant_layout',
        'selection_table_config',
        'price',
        'old_price',
        'image',
        'gallery',
        'description',
        'product_category_id',
        'tags',
        'badge',
        'featured',
        'active',
        'order',
        'stock_quantity',
        'track_stock',
        'shipping_weight_kg',
        'shipping_length_cm',
        'shipping_width_cm',
        'shipping_height_cm',
        'shipping_class',
        'ships_separately',
        'freight_delivery_price',
        'specifications',
        'variants',
        'variant_table_columns',
    ];

    protected $casts = [
        'show_variant_in_title' => 'boolean',
        'variant_options' => 'array',
        'selection_table_config' => 'array',
        'gallery' => 'array',
        'tags' => 'array',
        'featured' => 'boolean',
        'active' => 'boolean',
        'track_stock' => 'boolean',
        'shipping_weight_kg' => 'float',
        'shipping_length_cm' => 'float',
        'shipping_width_cm' => 'float',
        'shipping_height_cm' => 'float',
        'ships_separately' => 'boolean',
        'freight_delivery_price' => 'float',
        'specifications' => 'array',
        'variants' => 'array',
        'variant_table_columns' => 'array',
    ];

    public function category()
    {
        return $this->belongsTo(ProductCategory::class, 'product_category_id');
    }

    public function getImageAttribute($value)
    {
        return $this->normalizeMediaUrl($value);
    }

    public function getGalleryAttribute($value)
    {
        return $this->normalizeMediaArray($value);
    }

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function reviews()
    {
        return $this->hasMany(ProductReview::class);
    }
}
