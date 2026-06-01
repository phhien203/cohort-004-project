import { eq, and, sql } from "drizzle-orm";
import { db } from "~/db";
import { courseReviews } from "~/db/schema";

// ─── Review Service ───
// Handles course reviews (star ratings only).
// Uses positional parameters (project convention).

export function submitReview(userId: number, courseId: number, rating: number) {
  // Validate rating is between 1 and 5
  if (rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5");
  }

  // Check if user has already reviewed this course
  const existingReview = getUserReviewForCourse(userId, courseId);

  if (existingReview) {
    // Update existing review
    return db
      .update(courseReviews)
      .set({
        rating,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(courseReviews.id, existingReview.id))
      .run();
  } else {
    // Create new review
    return db
      .insert(courseReviews)
      .values({
        userId,
        courseId,
        rating,
      })
      .run();
  }
}

export function getUserReviewForCourse(userId: number, courseId: number) {
  return db
    .select()
    .from(courseReviews)
    .where(
      and(eq(courseReviews.userId, userId), eq(courseReviews.courseId, courseId))
    )
    .get();
}

export function getCourseAverageRating(courseId: number): number {
  const result = db
    .select({
      avgRating: sql<number>`COALESCE(AVG(${courseReviews.rating}), 0)`,
    })
    .from(courseReviews)
    .where(eq(courseReviews.courseId, courseId))
    .get();

  return result?.avgRating ?? 0;
}

export function getCourseReviewStats(courseId: number): {
  averageRating: number;
  totalReviews: number;
} {
  const result = db
    .select({
      avgRating: sql<number>`COALESCE(AVG(${courseReviews.rating}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(courseReviews)
    .where(eq(courseReviews.courseId, courseId))
    .get();

  return {
    averageRating: result?.avgRating ?? 0,
    totalReviews: result?.count ?? 0,
  };
}

export function deleteReview(userId: number, courseId: number) {
  return db
    .delete(courseReviews)
    .where(
      and(eq(courseReviews.userId, userId), eq(courseReviews.courseId, courseId))
    )
    .run();
}
