import { Star } from "lucide-react";

export function StarRating({
  rating,
  totalReviews,
  showCount = true,
  size = "sm",
  className,
}: {
  rating: number;
  totalReviews?: number;
  showCount?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const stars = Array.from({ length: 5 }, (_, i) => i + 1);

  const sizeClasses = {
    sm: "size-4",
    md: "size-5",
    lg: "size-6",
  };

  const iconSize = sizeClasses[size];

  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      <div className="flex gap-0.5">
        {stars.map((star) => (
          <Star
            key={star}
            className={`${iconSize} ${
              star <= Math.round(rating)
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        ))}
      </div>
      {showCount && totalReviews !== undefined && (
        <span className="text-sm text-muted-foreground">
          {rating > 0 ? rating.toFixed(1) : "No ratings"}
          {totalReviews > 0 && ` (${totalReviews})`}
        </span>
      )}
    </div>
  );
}
