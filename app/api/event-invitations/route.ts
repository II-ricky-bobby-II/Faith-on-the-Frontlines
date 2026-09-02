import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { eventInvitations } from "@/db/schema";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: FormDataEntryValue | null, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  const data = await request.formData();

  // Quietly accept bot submissions without adding them to the invitation list.
  if (clean(data.get("website"), 200)) {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  const email = clean(data.get("email"), 254).toLowerCase();
  const firstName = clean(data.get("firstName"), 80);
  const cityState = clean(data.get("cityState"), 120);
  const source = clean(data.get("source"), 40) || "website";
  const consent = data.get("consent") === "yes";

  if (!EMAIL_PATTERN.test(email) || !consent) {
    return NextResponse.json(
      { ok: false, message: "Enter a valid email and confirm you would like event invitations." },
      { status: 400 },
    );
  }

  try {
    const db = getDb();
    await db
      .insert(eventInvitations)
      .values({
        id: crypto.randomUUID(),
        email,
        firstName: firstName || null,
        cityState: cityState || null,
        source,
        consent: true,
      })
      .onConflictDoUpdate({
        target: eventInvitations.email,
        set: {
          firstName: firstName || null,
          cityState: cityState || null,
          source,
          consent: true,
          consentedAt: sql`CURRENT_TIMESTAMP`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
        setWhere: eq(eventInvitations.email, email),
      });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Unable to save event invitation signup", error);
    return NextResponse.json(
      { ok: false, message: "We could not add you right now. Please try again." },
      { status: 500 },
    );
  }
}
