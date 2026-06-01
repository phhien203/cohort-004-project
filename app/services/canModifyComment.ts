export function canModifyComment(
  commentAuthorId: number,
  currentUserId: number | null,
  courseInstructorId: number,
  deletedAt: string | null = null
) {
  if (!currentUserId || deletedAt !== null) {
    return false;
  }

  return currentUserId === commentAuthorId || currentUserId === courseInstructorId;
}
