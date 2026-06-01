import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import { getLessonDiscussion } from "./commentService";

function createLesson(courseId: number) {
  const mod = testDb
    .insert(schema.modules)
    .values({
      courseId,
      title: "Module 1",
      position: 1,
    })
    .returning()
    .get();

  return testDb
    .insert(schema.lessons)
    .values({
      moduleId: mod.id,
      title: "Lesson 1",
      position: 1,
    })
    .returning()
    .get();
}

describe("commentService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("getLessonDiscussion", () => {
    it("returns an empty array when a lesson has no comments", () => {
      const lesson = createLesson(base.course.id);

      expect(getLessonDiscussion(lesson.id)).toEqual([]);
    });

    it("groups top-level comments newest-first and replies oldest-first", () => {
      const lesson = createLesson(base.course.id);

      const olderTopLevel = testDb
        .insert(schema.lessonComments)
        .values({
          lessonId: lesson.id,
          userId: base.user.id,
          body: "Older top-level comment",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        })
        .returning()
        .get();

      const newerTopLevel = testDb
        .insert(schema.lessonComments)
        .values({
          lessonId: lesson.id,
          userId: base.instructor.id,
          body: "Newer top-level comment",
          createdAt: "2026-01-03T00:00:00.000Z",
          updatedAt: "2026-01-03T00:00:00.000Z",
        })
        .returning()
        .get();

      testDb.insert(schema.lessonComments).values([
        {
          lessonId: lesson.id,
          userId: base.instructor.id,
          parentId: olderTopLevel.id,
          body: "Second reply",
          createdAt: "2026-01-02T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
        {
          lessonId: lesson.id,
          userId: base.user.id,
          parentId: olderTopLevel.id,
          body: "First reply",
          createdAt: "2026-01-01T12:00:00.000Z",
          updatedAt: "2026-01-01T12:00:00.000Z",
        },
        {
          lessonId: lesson.id,
          userId: base.user.id,
          parentId: newerTopLevel.id,
          body: "Only reply",
          createdAt: "2026-01-04T00:00:00.000Z",
          updatedAt: "2026-01-04T00:00:00.000Z",
        },
      ]).run();

      const discussion = getLessonDiscussion(lesson.id);

      expect(discussion.map((thread) => thread.body)).toEqual([
        "Newer top-level comment",
        "Older top-level comment",
      ]);
      expect(discussion[0].replies.map((reply) => reply.body)).toEqual([
        "Only reply",
      ]);
      expect(discussion[1].replies.map((reply) => reply.body)).toEqual([
        "First reply",
        "Second reply",
      ]);
      expect(discussion[0].authorName).toBe(base.instructor.name);
      expect(discussion[1].authorName).toBe(base.user.name);
    });

    it("keeps soft-deleted comments in the returned discussion", () => {
      const lesson = createLesson(base.course.id);

      testDb
        .insert(schema.lessonComments)
        .values({
          lessonId: lesson.id,
          userId: base.user.id,
          body: "Deleted comment",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          deletedAt: "2026-01-02T00:00:00.000Z",
        })
        .run();

      const discussion = getLessonDiscussion(lesson.id);

      expect(discussion).toHaveLength(1);
      expect(discussion[0].body).toBe("Deleted comment");
      expect(discussion[0].deletedAt).toBe("2026-01-02T00:00:00.000Z");
    });
  });
});
