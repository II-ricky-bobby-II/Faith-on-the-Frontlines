import type { CollectionConfig } from "payload";

export const Events: CollectionConfig = {
  slug: "events",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "venue", "city", "date", "_status"],
  },
  access: {
    read: ({ req }) => req.user ? true : { _status: { equals: "published" } },
  },
  versions: {
    drafts: { autosave: { interval: 300 } },
    maxPerDoc: 20,
  },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "slug", type: "text", required: true, unique: true, index: true },
    {
      type: "row",
      fields: [
        { name: "venue", type: "text", required: true, admin: { width: "50%" } },
        { name: "speaker", type: "text", required: true, admin: { width: "50%" } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "city", type: "text", required: true, admin: { width: "50%" } },
        { name: "state", type: "text", required: true, admin: { width: "50%" } },
      ],
    },
    { name: "address", type: "text", required: true },
    {
      type: "row",
      fields: [
        { name: "date", type: "date", required: true, index: true, admin: { width: "50%", date: { pickerAppearance: "dayOnly" } } },
        { name: "time", type: "text", required: true, admin: { width: "50%", description: "Example: 6:30 PM - 8:30 PM" } },
      ],
    },
    { name: "theme", type: "text", required: true },
    { name: "image", type: "upload", relationTo: "media", required: true },
    { name: "description", type: "textarea", required: true },
    { name: "contactEmail", type: "email", required: true },
    { name: "registrationUrl", type: "text" },
  ],
};
