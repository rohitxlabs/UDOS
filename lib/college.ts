// The College row in the platform database is a singleton — one deployment
// serves one college. Its primary key is this constant rather than a
// generated id so every read and write targets the same row by name, and a
// second college cannot be created here by accident.
export const COLLEGE_ID = "college";

// The college's own non-deletable administrator role, seeded into the
// college database. Named once here because the seed creates it and the
// platform's module grants have to find it again later to keep its
// permissions in step with what the college has been given.
export const COLLEGE_ADMIN_ROLE = "College Admin";

// Every capability a permission row can carry. The College Admin role gets
// all of them on every granted module; what everyone else gets is the
// College Admin's decision, not the platform's.
export const FULL_ACCESS = ["VIEW", "CREATE", "EDIT", "DELETE", "APPROVE", "EXPORT", "PRINT"] as const;
