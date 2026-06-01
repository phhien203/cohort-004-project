import { desc, eq } from "drizzle-orm";
import { db } from "~/db";
import { lessonComments, users, type UserRole } from "~/db/schema";

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
