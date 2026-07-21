import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const data = await request.formData();
  const email = String(data.get("email") ?? "");
  const contactName = String(data.get("contactName") ?? "");
  if (!contactName || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ ok: false }, { status: 400 });
  // TODO: Send the validated inquiry to Global Fellowship's email provider or CRM.
  return NextResponse.json({ ok: true }, { status: 202 });
}
