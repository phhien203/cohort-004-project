import { and, desc, eq } from "drizzle-orm";
import { db } from "~/db";
import {
  courses,
  enrollments,
  lessonComments,
  lessons,
  modules,
  users,
  type UserRole,
} from "~/db/schema";

export type LessonDiscussionComment = {
  id: number;
  lessonId: number;
  userId: number;
  parentId: number | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  authorRole: UserRole;
};

export type LessonDiscussionThread = LessonDiscussionComment & {
  replies: LessonDiscussionComment[];
};

export function createLessonComment(
  userId: number,
  lessonId: number,
  body: string,
  parentId: number | null = null
) {
  const lessonAccess = db
    .select({
      courseId: modules.courseId,
      instructorId: courses.instructorId,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(lessons.id, lessonId))
    .get();

  if (!lessonAccess) {
    throw new Error("Lesson not found");
  }

  const canComment =
    lessonAccess.instructorId === userId ||
    !!db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.userId, userId),
          eq(enrollments.courseId, lessonAccess.courseId)
        )
      )
      .get();

  if (!canComment) {
    throw new Error("You do not have access to comment on this lesson");
  }

  if (parentId !== null) {
    const parentComment = db
      .select({
        id: lessonComments.id,
        lessonId: lessonComments.lessonId,
        parentId: lessonComments.parentId,
      })
      .from(lessonComments)
      .where(eq(lessonComments.id, parentId))
      .get();

    if (!parentComment || parentComment.lessonId !== lessonId) {
      throw new Error("Parent comment not found");
    }

    if (parentComment.parentId !== null) {
      throw new Error("Replies can only be added to top-level comments");
    }
  }

  return db
    .insert(lessonComments)
    .values({
      lessonId,
      userId,
      parentId,
      body,
    })
    .returning()
    .get();
}

export function getLessonDiscussion(
  lessonId: number
): LessonDiscussionThread[] {
  const rows = db
    .select({
      id: lessonComments.id,
      lessonId: lessonComments.lessonId,
      userId: lessonComments.userId,
      parentId: lessonComments.parentId,
      body: lessonComments.body,
      createdAt: lessonComments.createdAt,
      updatedAt: lessonComments.updatedAt,
      deletedAt: lessonComments.deletedAt,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
      authorRole: users.role,
    })
    .from(lessonComments)
    .innerJoin(users, eq(lessonComments.userId, users.id))
    .where(eq(lessonComments.lessonId, lessonId))
    .orderBy(desc(lessonComments.createdAt))
    .all();

  const topLevelComments = rows
    .filter((comment) => comment.parentId === null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const repliesByParent = new Map<number, LessonDiscussionComment[]>();

  for (const comment of rows) {
    if (comment.parentId === null) {
      continue;
    }

    const replies = repliesByParent.get(comment.parentId) ?? [];
    replies.push(comment);
    repliesByParent.set(comment.parentId, replies);
  }

  for (const replies of repliesByParent.values()) {
    replies.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  return topLevelComments.map((comment) => ({
    ...comment,
    replies: repliesByParent.get(comment.id) ?? [],
  }));
}
