## Problem Statement

Students working through a lesson have no way to ask questions, share their work, or discuss the material in context. When something is unclear, their only options are to leave the platform or stay stuck. Instructors, likewise, have no in-lesson channel to answer those questions where they arise. The conversation that naturally happens around learning content has nowhere to live.

## Solution

Add a **Discussion** section to each lesson where enrolled students and the course instructor can post comments and reply to one another. Students can ask a question directly under the lesson; the instructor (and other students) can answer it in a reply that nests under the original question. Authors can edit or remove their own comments, and the instructor can remove any comment to keep the discussion clean. Authoritative answers from the course instructor are visibly badged so students can trust them at a glance.

This ships as a focused MVP: plain-text comments, one level of replies, gated to enrolled learners and the instructor.

## User Stories

1. As an enrolled student, I want to post a comment on a lesson, so that I can ask a question about the material where it is relevant.
2. As an enrolled student, I want to reply to another comment, so that I can respond to a specific question or point.
3. As an enrolled student, I want to read all comments and replies on a lesson, so that I can learn from questions others have already asked.
4. As an enrolled student, I want my reply to appear nested under the comment it answers, so that the conversation is easy to follow.
5. As an enrolled student, I want to see top-level comments with the newest first, so that I can see what people are discussing right now.
6. As an enrolled student, I want replies within a thread ordered oldest-first, so that each conversation reads naturally top to bottom.
7. As an enrolled student, I want to edit my own comment, so that I can fix a typo or clarify what I meant.
8. As an enrolled student, I want to delete my own comment, so that I can remove something I no longer want posted.
9. As an enrolled student, I want my own posts, edits, and deletions to appear immediately, so that the interface feels responsive.
10. As an enrolled student, I want to see who wrote each comment with their name and avatar, so that I know who I am talking to.
11. As an enrolled student, I want comments written by the course instructor to be clearly badged, so that I can trust authoritative answers.
12. As an enrolled student, I want to see when a comment was posted, so that I can judge how current it is.
13. As an enrolled student, I want an inviting empty state when no one has commented yet, so that I feel encouraged to start the discussion.
14. As an enrolled student, I want to know when a comment has been edited, so that I understand the content may have changed since posting.
15. As an enrolled student, I want deleted comments to show as a placeholder when they still have replies, so that the surrounding conversation still makes sense.
16. As the course instructor, I want to comment on my own lessons, so that I can add context or address common questions.
17. As the course instructor, I want to reply to a student's question, so that I can answer it in context.
18. As the course instructor, I want to delete any comment on my course's lessons, so that I can remove spam, abuse, or off-topic content.
19. As the course instructor, I want to edit my own comments, so that I can correct or improve my answers.
20. As the course instructor, I want my comments to carry an instructor badge, so that students recognise my answers as authoritative.
21. As a non-enrolled visitor, I want the discussion to be hidden from me, so that course discussion stays private to participants.
22. As a logged-out visitor, I want no access to comments, so that the discussion remains restricted to enrolled learners and the instructor.
23. As any commenter, I want my multi-line comment to preserve its line breaks, so that lists and paragraphs stay readable.
24. As any commenter, I want a compose box at the top of the discussion, so that I can post without scrolling.
25. As any commenter, I want my comment text rendered safely as plain text, so that no markup or script can be injected through comments.

## Implementation Decisions

### Schema
- New table `lesson_comments` with: `id` (PK, autoincrement); `lessonId` (FK → `lessons.id`, not null); `userId` (FK → `users.id`, not null, the author); `parentId` (nullable FK → `lesson_comments.id` — null means top-level, set means reply); `body` (text, not null, plain text); `createdAt` and `updatedAt` (ISO-8601 text, default now); `deletedAt` (nullable ISO-8601 text — non-null indicates a soft delete).
- Migration generated via the existing Drizzle workflow (`db:generate`).

### Threading
- Exactly one level of nesting. Top-level comments may have replies; replies cannot themselves be replied to. The single nullable `parentId` column supports this with no extra structure, and leaves the door open to deeper nesting later by changing only the read/render layers.

### Access control
- Reading and writing are both gated to users enrolled in the course, plus the course instructor (matched on the course's `instructorId` equal to the current user). Non-enrolled and logged-out visitors see no discussion section at all. This reuses the lesson route's existing `enrolled` flag and `currentUserId`.

### Edit / delete
- Authors may edit and soft-delete their own comments. The course instructor may soft-delete any comment on their course's lessons. Deletes are always soft (set `deletedAt`); rows are never hard-deleted, which keeps reply chains intact.
- Editing bumps `updatedAt`; an "edited" indicator is shown when `updatedAt` differs meaningfully from `createdAt`.

### Deleted comment rendering
- Tombstone always: a soft-deleted comment renders as a "[comment deleted]" placeholder in place, preserving the structure of any thread it belongs to.

### Ordering
- Top-level comments newest-first (`createdAt DESC`); replies within a thread oldest-first (`createdAt ASC`). ISO-8601 timestamp strings sort lexicographically in chronological order, so no special handling is required.

### Volume / freshness
- All comments for a lesson load in a single pass with no pagination, consistent with every other loader in the app. A temporary upper `LIMIT` guard may be added as cheap insurance against a pathological lesson.
- No live updates. A commenter's own actions reflect immediately via React Router loader revalidation after the fetcher action; other users' new comments appear on next navigation or refresh.

### Modules
- **`commentService`** — the core deep module. Public interface: fetch-and-group comments for a lesson (joined to author name/avatar/role, grouped into newest-first top-level plus oldest-first replies, including soft-deleted rows so tombstones can render); create a comment (optionally as a reply); edit a comment; soft-delete a comment. Authorization is enforced inside the write operations. Follows the established service conventions used by `reviewService` and `progressService`.
- **`canModifyComment`** — a pure, dependency-free decision function. Given a comment's author id, the current user id, and the course's instructor id, it returns whether the current user may modify (edit/delete) the comment. Keeps authorization logic out of the route and trivially testable in isolation.
- **Lesson route wiring** — the existing lesson view route's loader is extended to fetch and group comments; its `action` gains intents `create-comment`, `edit-comment`, and `delete-comment`, following the existing intent-dispatch pattern in that route.
- **`LessonComments` UI component** — presentational. Renders the compose box at the top, the threaded list, per-thread inline reply affordance, author identity with avatar and the instructor badge, edited indicators, tombstones, and the empty state. Placed in the lesson content column immediately after the lesson content and before the quiz. Gated on enrollment and a signed-in user.

### Presentation
- Comment bodies are plain text, rendered with preserved whitespace/line breaks; no Markdown and no HTML injection.
- Compose box sits at the top of the discussion section; each thread has its own inline "Reply" affordance.
- Author identity reuses the existing avatar component; an "Instructor" badge appears when the author is the course's instructor (matched on the course's instructor id, not merely any instructor-role user).
- Timestamps are shown as absolute dates.
- Empty state shows an inviting prompt such as "No comments yet. Start the discussion!"

## Testing Decisions

Good tests here exercise observable behavior through each module's public interface — the data and authorization outcomes a caller can see — not internal query construction or component internals. Tests should read as statements about what the feature does, and should survive refactors that preserve behavior.

- **`commentService`** will be tested. Coverage: creating top-level comments and replies; editing updates the body and bumps the updated timestamp; soft-deleting sets the deletion marker without removing the row; fetched results group correctly into newest-first top-level and oldest-first replies; soft-deleted comments are still returned so tombstones can render; and write operations enforce authorization (author and course instructor permitted, unrelated users rejected). Prior art: `reviewService.test.ts`, `progressService.test.ts`, `enrollmentService.test.ts`.
- **`canModifyComment`** will be tested as a pure function: the author is allowed; the course instructor is allowed for any comment; an unrelated enrolled user is denied; behavior on already-deleted comments is well-defined. Prior art: the pure-logic tests in `ppp.test.ts`.
- The lesson route loader/action wiring and the `LessonComments` UI component are not unit-test targets for this MVP; their behavior is covered indirectly through `commentService` and verified manually.

## Out of Scope

The following are deliberately deferred. None requires schema changes or rework of the above:

- Markdown formatting in comments (and the HTML sanitization that would require).
- Pagination or "load more" for high-volume lessons.
- Live updates / polling so other users' comments appear without a refresh.
- Relative timestamps ("2 days ago").
- Reply-to-reply (nesting deeper than one level).
- Seeded comment fixtures — the feature will be exercised live via the DevUI user-switcher (post as a student, switch to the instructor to answer).
- Notifications to instructors or students when a comment or reply is posted.

## Further Notes

- The closest existing precedent is the course review feature (`course_reviews` table + `reviewService`): a per-lesson user-generated record with a service layer and intent-based action handling. The comment feature follows the same shape, adding threading and soft delete.
- Manual verification uses the DevUI user-switcher to post as a student and then as the course instructor, confirming threading, the instructor badge, edit, soft-delete tombstones, and the empty state all render correctly without seed data.
- Keeping deletes soft and the body plain-text means the MVP is safe by construction (no orphaned replies, no injection surface) while leaving clean upgrade paths to Markdown and deeper threading.
