import type { CollectionConfig } from "payload";

export const Media: CollectionConfig = {
  slug: "media",
  access: { read: () => true },
  admin: { useAsTitle: "alt" },
  upload: {
    mimeTypes: ["image/*"],
    imageSizes: [
      { name: "card", width: 900, height: 600, position: "centre" },
      { name: "hero", width: 1800, height: 1100, position: "centre" },
    ],
  },
  fields: [
    { name: "alt", type: "text", required: true },
  ],
};
