import { eq, and } from "drizzle-orm";
import { db } from "~/db";
import { lessonBookmarks, lessons, modules } from "~/db/schema";

// ─── Bookmark Service ───
// Handles per-user lesson bookmarks.

export function toggleBookmark(opts: {
  userId: number;
  lessonId: number;
}): { bookmarked: boolean } {
  const { userId, lessonId } = opts;

  const existing = db
    .select()
    .from(lessonBookmarks)
    .where(
      and(eq(lessonBookmarks.userId, userId), eq(lessonBookmarks.lessonId, lessonId))
    )
    .get();

  if (existing) {
    db.delete(lessonBookmarks).where(eq(lessonBookmarks.id, existing.id)).run();
    return { bookmarked: false };
  } else {
    db.insert(lessonBookmarks).values({ userId, lessonId }).run();
    return { bookmarked: true };
  }
}

export function isLessonBookmarked(opts: {
  userId: number;
  lessonId: number;
}): boolean {
  const existing = db
    .select()
    .from(lessonBookmarks)
    .where(
      and(
        eq(lessonBookmarks.userId, opts.userId),
        eq(lessonBookmarks.lessonId, opts.lessonId)
      )
    )
    .get();

  return existing !== undefined;
}

export function getBookmarkedLessonIds(opts: {
  userId: number;
  courseId: number;
}): number[] {
  const rows = db
    .select({ lessonId: lessonBookmarks.lessonId })
    .from(lessonBookmarks)
    .innerJoin(lessons, eq(lessonBookmarks.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(
      and(eq(lessonBookmarks.userId, opts.userId), eq(modules.courseId, opts.courseId))
    )
    .all();

  return rows.map((row) => row.lessonId);
}
