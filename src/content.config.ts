import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

export const brandCollection = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "src/content/brands" }),
  schema: z.object({
    id: z.string(),
    names: z.object({ en: z.string(), zh: z.string() }),
    slug: z.string(),
    logo: z.string().default(""),
    website: z.string().optional(),
    country: z.string().default("CN"),
    category: z.enum(["nev", "fuel", "joint"]).default("nev"),
    description: z.object({ en: z.string().default(""), zh: z.string().default("") }),
    featured: z.boolean().default(false),
    order: z.number().default(0),
    vehicleCount: z.number().optional(),
  }),
});

export const vehicleCollection = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "src/content/vehicles" }),
  schema: z.object({
    id: z.string(),
    names: z.object({ en: z.string(), zh: z.string() }),
    slug: z.string(),
    brand: z.string(),
    type: z.enum(["SEDAN", "SUV", "MPV", "MINI", "LCV", "SPORTS", "OFFROAD"]),
    fuelType: z.enum(["electric", "plug_in_hybrid", "extended_range", "petrol"]),
    year: z.number(),
    images: z.array(z.string()).default([]),
    specs: z.object({
      range_km: z.number().optional(),
      battery_kwh: z.number().optional(),
      power_kw: z.number().optional(),
      top_speed_kmh: z.number().optional(),
      seats: z.number().optional(),
      drive: z.string().optional(),
      length_mm: z.number().optional(),
      width_mm: z.number().optional(),
      height_mm: z.number().optional(),
      charging_fast: z.string().optional(),
      charging_slow: z.string().optional(),
      engine: z.string().optional(),
      transmission: z.string().optional(),
    }),
    featured: z.boolean().default(false),
    inStock: z.boolean().default(true),
    isNew: z.boolean().default(false),
    order: z.number().default(0),
    description: z.object({ en: z.string().default(""), zh: z.string().default("") }),
  }),
});

export const collections = { brands: brandCollection, vehicles: vehicleCollection };
