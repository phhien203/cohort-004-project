import { useState } from "react";
import { Star } from "lucide-react";

export function StarRatingInput({
  value,
  onChange,
  name,
  size = "md",
  className,
}: {
  value: number;
  onChange: (rating: number) => void;
  name?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [hoverRating, setHoverRating] = useState(0);
  const stars = Array.from({ length: 5 }, (_, i) => i + 1);

  const sizeClasses = {
    sm: "size-5",
    md: "size-6",
    lg: "size-8",
  };

  const iconSize = sizeClasses[size];
  const displayRating = hoverRating || value;

  return (
    <div className={className}>
      <div className="flex gap-1">
        {stars.map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="cursor-pointer transition-transform hover:scale-110"
            aria-label={`Rate ${star} stars`}
          >
            <Star
              className={`${iconSize} ${
                star <= displayRating
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300"
              }`}
            />
          </button>
        ))}
      </div>
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
