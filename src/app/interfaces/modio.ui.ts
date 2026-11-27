export type ModioAuth = {
  token: string;
  expires: number;
};

export type ModioToken = {
  access_token: string;
  date_expires: number;
};

export type ModioSort =
  'name' | '-popular' | '-downloads_total' | '-date_updated';

export type ModioMod = {
  id: number;
  name: string;
  summary: string;
  profile_url: string;
  submitted_by: { username: string };
  modfile: {
    version: string | null;
    download: { binary_url: string; date_expires: number };
  };
};

export type ModioPage = {
  data: ModioMod[];
  result_total: number;
};

export type ModioSearch = {
  query: string;
  sort: ModioSort;
  offset: number;
};
