import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

// Import after mock so the module picks up our test db
import {
  toggleBookmark,
  isLessonBookmarked,
  getBookmarkedLessonIds,
} from "./bookmarkService";

function createModuleWithLessons(
  courseId: number,
  moduleTitle: string,
  position: number,
  lessonCount: number
) {
  const mod = testDb
    .insert(schema.modules)
    .values({ courseId, title: moduleTitle, position })
    .returning()
    .get();

  const createdLessons = [];
  for (let i = 0; i < lessonCount; i++) {
    const lesson = testDb
      .insert(schema.lessons)
      .values({ moduleId: mod.id, title: `Lesson ${i + 1}`, position: i + 1 })
      .returning()
      .get();
    createdLessons.push(lesson);
  }

  return { module: mod, lessons: createdLessons };
}

describe("bookmarkService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("toggleBookmark", () => {
    it("creates a bookmark when none exists", () => {
      const { lessons } = createModuleWithLessons(base.course.id, "Module 1", 1, 1);

      const result = toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id });

      expect(result).toEqual({ bookmarked: true });
      expect(
        isLessonBookmarked({ userId: base.user.id, lessonId: lessons[0].id })
      ).toBe(true);
    });

    it("removes the bookmark when one already exists", () => {
      const { lessons } = createModuleWithLessons(base.course.id, "Module 1", 1, 1);

      toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id });
      const result = toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id });

      expect(result).toEqual({ bookmarked: false });
      expect(
        isLessonBookmarked({ userId: base.user.id, lessonId: lessons[0].id })
      ).toBe(false);
    });

    it("scopes bookmarks per user", () => {
      const { lessons } = createModuleWithLessons(base.course.id, "Module 1", 1, 1);
      const otherUser = testDb
        .insert(schema.users)
        .values({
          name: "Other User",
          email: "other@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id });

      expect(
        isLessonBookmarked({ userId: otherUser.id, lessonId: lessons[0].id })
      ).toBe(false);
    });
  });

  describe("isLessonBookmarked", () => {
    it("returns false when no bookmark exists", () => {
      const { lessons } = createModuleWithLessons(base.course.id, "Module 1", 1, 1);

      expect(
        isLessonBookmarked({ userId: base.user.id, lessonId: lessons[0].id })
      ).toBe(false);
    });
  });

  describe("getBookmarkedLessonIds", () => {
    it("returns bookmarked lesson ids scoped to the given course", () => {
      const { lessons } = createModuleWithLessons(base.course.id, "Module 1", 1, 3);

      toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id });
      toggleBookmark({ userId: base.user.id, lessonId: lessons[2].id });

      const ids = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: base.course.id,
      });

      expect(ids.sort()).toEqual([lessons[0].id, lessons[2].id].sort());
    });

    it("does not include bookmarks from other courses", () => {
      const { lessons } = createModuleWithLessons(base.course.id, "Module 1", 1, 1);
      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "Another course",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();
      const { lessons: otherLessons } = createModuleWithLessons(
        otherCourse.id,
        "Module 1",
        1,
        1
      );

      toggleBookmark({ userId: base.user.id, lessonId: lessons[0].id });
      toggleBookmark({ userId: base.user.id, lessonId: otherLessons[0].id });

      const ids = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: base.course.id,
      });

      expect(ids).toEqual([lessons[0].id]);
    });

    it("returns an empty array when the user has no bookmarks", () => {
      createModuleWithLessons(base.course.id, "Module 1", 1, 2);

      const ids = getBookmarkedLessonIds({
        userId: base.user.id,
        courseId: base.course.id,
      });

      expect(ids).toEqual([]);
    });
  });
});
