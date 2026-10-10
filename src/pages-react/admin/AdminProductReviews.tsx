import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Link } from "react-router-dom";
import { SortableTableHeader, sortRows, useTableSort } from "@/components/admin/SortableTableHeader";

export default function AdminProductReviews() {
    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [ratingFilter, setRatingFilter] = useState("all");
    const { sort, toggleSort } = useTableSort("created_at", "desc");

    useEffect(() => {
        loadReviews();
    }, []);

    const loadReviews = async () => {
        try {
            const res = await apiFetch<any[]>("/admin/product-reviews");
            setReviews(res);
        } catch (e) {
            toast.error("Failed to load reviews");
        } finally {
            setLoading(false);
        }
    };

    const filteredReviews = sortRows(reviews
        .filter((r) => {
            const matchesSearch =
                (r.product?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                (r.customer?.name || "").toLowerCase().includes(searchTerm.toLowerCase());
            const matchesRating = ratingFilter === "all" || r.rating.toString() === ratingFilter;
            return matchesSearch && matchesRating;
        }), sort.key, sort.direction);

    if (loading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold font-sans text-[#10275c]">Product Reviews</h1>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 mb-4">
                <input
                    type="text"
                    placeholder="Search reviews..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-10 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary w-full lg:w-80 text-sm"
                />
                <select
                    value={ratingFilter}
                    onChange={(e) => setRatingFilter(e.target.value)}
                    className="h-10 px-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-white w-full lg:w-48"
                >
                    <option value="all">All Ratings</option>
                    <option value="5">5 Stars</option>
                    <option value="4">4 Stars</option>
                    <option value="3">3 Stars</option>
                    <option value="2">2 Stars</option>
                    <option value="1">1 Star</option>
                </select>
            </div>

            <div className="rounded-lg bg-white shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <SortableTableHeader label="Product" sortKey="product.name" sort={sort} onSort={toggleSort} />
                            <SortableTableHeader label="Customer" sortKey="customer.name" sort={sort} onSort={toggleSort} />
                            <SortableTableHeader label="Rating & Comment" sortKey="rating" sort={sort} onSort={toggleSort} />
                            <SortableTableHeader label="Date" sortKey="created_at" sort={sort} onSort={toggleSort} />
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredReviews.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-500">
                                    No reviews found.
                                </td>
                            </tr>
                        ) : (
                            filteredReviews.map((review) => (
                                <tr key={review.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#10275c] font-medium">
                                        <Link to={`/shop/${review.product?.slug || review.product?.id}`} target="_blank" className="hover:text-orange hover:underline">
                                            {review.product?.name || "Unknown Product"}
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {review.customer?.name || "Unknown Customer"}
                                        <br />
                                        <span className="text-xs text-gray-400">{review.customer?.email}</span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-sm w-96">
                                        <div className="flex items-center gap-1 mb-1">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Star
                                                    key={star}
                                                    className={`w-3.5 h-3.5 ${star <= review.rating ? 'fill-orange text-orange' : 'text-gray-300'}`}
                                                />
                                            ))}
                                            <span className="ml-2 font-medium">{review.rating} / 5</span>
                                        </div>
                                        {review.comment ? (
                                            <p className="whitespace-normal text-xs leading-relaxed">{review.comment}</p>
                                        ) : (
                                            <span className="text-gray-400 italic text-xs">No comment</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(review.created_at).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
