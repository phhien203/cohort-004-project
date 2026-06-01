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

import {
  createLessonComment,
  getLessonDiscussion,
  softDeleteLessonComment,
  updateLessonComment,
} from "./commentService";

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

  describe("createLessonComment", () => {
    it("creates a new top-level lesson comment for an enrolled student", () => {
      const lesson = createLesson(base.course.id);

      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
        })
        .run();

      const comment = createLessonComment(
        base.user.id,
        lesson.id,
        "First post\nwith two lines"
      );

      expect(comment.lessonId).toBe(lesson.id);
      expect(comment.userId).toBe(base.user.id);
      expect(comment.parentId).toBeNull();
      expect(comment.body).toBe("First post\nwith two lines");
      expect(comment.createdAt).toBeDefined();
      expect(comment.updatedAt).toBeDefined();
    });

    it("allows the course instructor to create a top-level lesson comment", () => {
      const lesson = createLesson(base.course.id);

      const comment = createLessonComment(
        base.instructor.id,
        lesson.id,
        "Instructor clarification"
      );

      expect(comment.userId).toBe(base.instructor.id);
      expect(comment.body).toBe("Instructor clarification");
    });

    it("creates a reply under a top-level comment", () => {
      const lesson = createLesson(base.course.id);

      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
        })
        .run();

      const parent = createLessonComment(
        base.instructor.id,
        lesson.id,
        "Top-level question"
      );

      const reply = createLessonComment(
        base.user.id,
        lesson.id,
        "Threaded answer",
        parent.id
      );

      expect(reply.parentId).toBe(parent.id);

      const discussion = getLessonDiscussion(lesson.id);
      expect(discussion[0].replies.map((item) => item.body)).toEqual([
        "Threaded answer",
      ]);
    });

    it("rejects replies to replies", () => {
      const lesson = createLesson(base.course.id);

      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
        })
        .run();

      const parent = createLessonComment(
        base.instructor.id,
        lesson.id,
        "Top-level question"
      );
      const reply = createLessonComment(
        base.user.id,
        lesson.id,
        "First reply",
        parent.id
      );

      expect(() =>
        createLessonComment(
          base.instructor.id,
          lesson.id,
          "Nested too deep",
          reply.id
        )
      ).toThrow("Replies can only be added to top-level comments");
    });

    it("rejects users who are neither enrolled nor the instructor", () => {
      const lesson = createLesson(base.course.id);
      const outsider = testDb
        .insert(schema.users)
        .values({
          name: "Outsider",
          email: "outsider@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      expect(() =>
        createLessonComment(outsider.id, lesson.id, "Should not work")
      ).toThrow("You do not have access to comment on this lesson");
    });
  });

  describe("updateLessonComment", () => {
    it("allows an author to edit their own comment and bumps updatedAt", () => {
      const lesson = createLesson(base.course.id);

      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
        })
        .run();

      const comment = testDb
        .insert(schema.lessonComments)
        .values({
          lessonId: lesson.id,
          userId: base.user.id,
          body: "Original body",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        })
        .returning()
        .get();

      const updated = updateLessonComment(
        base.user.id,
        comment.id,
        "Clarified body"
      );

      expect(updated.body).toBe("Clarified body");
      expect(updated.updatedAt).not.toBe("2026-01-01T00:00:00.000Z");
    });

    it("rejects unrelated users", () => {
      const lesson = createLesson(base.course.id);
      const outsider = testDb
        .insert(schema.users)
        .values({
          name: "Outsider",
          email: "outsider-2@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      const comment = testDb
        .insert(schema.lessonComments)
        .values({
          lessonId: lesson.id,
          userId: base.user.id,
          body: "Original body",
        })
        .returning()
        .get();

      expect(() =>
        updateLessonComment(outsider.id, comment.id, "Should fail")
      ).toThrow("You do not have access to edit this comment");
    });
  });

  describe("softDeleteLessonComment", () => {
    it("allows an author to soft-delete their own comment without replies", () => {
      const lesson = createLesson(base.course.id);

      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
        })
        .run();

      const comment = createLessonComment(
        base.user.id,
        lesson.id,
        "Temporary note"
      );
      const deleted = softDeleteLessonComment(base.user.id, comment.id);

      expect(deleted.deletedAt).toBeDefined();

      const discussion = getLessonDiscussion(lesson.id);
      expect(discussion[0].deletedAt).not.toBeNull();
    });

    it("allows the course instructor to soft-delete a thread that has replies", () => {
      const lesson = createLesson(base.course.id);

      testDb
        .insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: base.course.id,
        })
        .run();

      const parent = createLessonComment(
        base.user.id,
        lesson.id,
        "Student question"
      );
      createLessonComment(
        base.instructor.id,
        lesson.id,
        "Instructor answer",
        parent.id
      );

      softDeleteLessonComment(base.instructor.id, parent.id);

      const discussion = getLessonDiscussion(lesson.id);
      expect(discussion[0].deletedAt).not.toBeNull();
      expect(discussion[0].replies).toHaveLength(1);
    });

    it("rejects unrelated users", () => {
      const lesson = createLesson(base.course.id);
      const outsider = testDb
        .insert(schema.users)
        .values({
          name: "Outsider",
          email: "outsider-3@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      const comment = createLessonComment(
        base.instructor.id,
        lesson.id,
        "Protected note"
      );

      expect(() => softDeleteLessonComment(outsider.id, comment.id)).toThrow(
        "You do not have access to delete this comment"
      );
    });
  });
});
