export type JurisdictionLevel = "federal" | "state" | "county";

export type CrossReference = {
  id: string;
  raw_text: string;
  target_type: "internal" | "external";
  target_provision_id: string | null;
  target_url: string | null;
};

export type Provision = {
  id: string;
  citation: string;
  title: string;
  jurisdiction_level: JurisdictionLevel;
  issuing_body: string;
  parent_id: string | null;
  full_text: string;
  ai_summary: string | null;
  source_url: string | null;
  last_verified_date: string | null;
  is_public: boolean;
  sort_order: number;
  cross_references?: CrossReference[];
};
