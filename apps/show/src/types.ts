/**
 * Show 频道前端类型
 *
 * 与后端 app/schemas/show.py 一一对应（ApiResponse.data 的内层结构）。
 */

export type Audience = 'family' | 'parent' | 'child';
export type Brand = 'jiwa' | 'finestem' | string;

export interface VideoResource {
  id: string;
  audience: Audience | null;
  title: string;
  embed_url: string;
  page?: string | null;
}

export interface DocResource {
  title: string;
  url: string;
  format: string;
}

export interface ProjectLink {
  title: string;
  url: string;
  note: string;
}

export interface InteractiveResource {
  title: string;
  url: string;
  ratio: string;
}

export interface EpisodeResources {
  interactive: InteractiveResource | null;
  videos: VideoResource[];
  docs: DocResource[];
  projects: ProjectLink[];
}

export interface EpisodeSummary {
  series_slug: string;
  series_title: string;
  brand: Brand;
  theme_color: string;
  slug: string;
  episode_no: number;
  title: string;
  summary: string;
  audience: Audience;
  tags: string[];
  published_at: string | null;
  cover: string | null;
  url: string;
  has_interactive: boolean;
  video_audiences: string[];
  has_docs: boolean;
  has_projects: boolean;
}

export interface EpisodeDetail extends EpisodeSummary {
  description_md: string;
  announce: Record<string, string>;
  default_tab: string | null;
  resources: EpisodeResources;
  prev: EpisodeSummary | null;
  next: EpisodeSummary | null;
}

export interface SeriesSummary {
  slug: string;
  title: string;
  subtitle: string;
  brand: Brand;
  description: string;
  tags: string[];
  audience: Audience;
  theme_color: string;
  cover: string | null;
  url: string;
  episode_count: number;
  latest_published_at: string | null;
}

export interface SeriesDetail extends SeriesSummary {
  episodes: EpisodeSummary[];
  docs: DocResource[];
}

export interface FeaturedEpisode {
  note: string;
  episode: EpisodeSummary;
}

export interface TagStat {
  name: string;
  count: number;
}

export interface ShowHome {
  site: {
    title?: string;
    subtitle?: string;
    description?: string;
    finestem_url?: string;
  };
  featured: FeaturedEpisode | null;
  series: SeriesSummary[];
  episodes: EpisodeSummary[];
  tags: TagStat[];
}
