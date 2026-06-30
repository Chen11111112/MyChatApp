export function toSearchableEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function toSearchableNickname(nickname: string): string {
  return nickname.trim().toLowerCase();
}

export function buildUserSearchFields(email: string, nickname: string) {
  const trimmedEmail = email.trim();
  const trimmedNickname = nickname.trim() || trimmedEmail.split('@')[0];
  return {
    email: trimmedEmail,
    nickname: trimmedNickname,
    emailLower: toSearchableEmail(trimmedEmail),
    nicknameLower: toSearchableNickname(trimmedNickname),
  };
}
