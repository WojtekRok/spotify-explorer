// Contains all Spotify API interface definitions

export interface SpotifyImage {
  url: string;
  height?: number;
  width?: number;
}

export interface SpotifyExternalUrls {
  spotify?: string;
}

export interface SpotifyOwner { 
  id: string;
  display_name?: string;
  external_urls?: SpotifyExternalUrls;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  uri?: string; 
  external_urls?: SpotifyExternalUrls;
  images?: SpotifyImage[];
  genres?: string[];
  popularity?: number; 
  followers?: { href: null; total: number }; 
}

export interface SpotifyAlbumSimple { 
  id: string;
  name: string;
  uri?: string;
  release_date?: string;
  images?: SpotifyImage[];             
  external_urls?: SpotifyExternalUrls; 
  artists: SpotifyArtist[];
  album_type?: string;            
}

export interface SpotifyAlbum extends SpotifyAlbumSimple { 
  album_type?: 'album' | 'single' | 'compilation'; 
  available_markets?: string[];
  href?: string; 
  release_date_precision?: 'year' | 'month' | 'day';
  total_tracks?: number;
  type?: 'album'; 
  popularity?: number;
}

export interface SpotifyTrack { 
  id: string;
  name: string;
  uri: string;
  artists: SpotifyArtist[];
  album?: SpotifyAlbumSimple;
  external_urls?: SpotifyExternalUrls;
  duration_ms?: number;
  explicit?: boolean;
  is_local?: boolean;
  preview_url?: string | null;
}

export interface SpotifyAlbumTrack {
  id: string; 
  name: string; 
  uri: string; 
  artists: SpotifyArtist[];
  disc_number?: number; 
  duration_ms?: number; 
  explicit?: boolean;
  preview_url?: string | null; 
  track_number?: number; 
  is_local?: boolean;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description?: string | null;
  owner: SpotifyOwner;
  tracks: { total: number; href: string };
  images?: SpotifyImage[];
  public?: boolean;
  collaborative?: boolean;
  external_urls?: SpotifyExternalUrls;
  uri?: string;
}

export interface SpotifyPlaylistTrackObject {
  added_at: string | null;
  added_by: { id: string } | null;
  is_local: boolean;
  track: SpotifyTrack | null;
}

export interface SpotifyArtistAlbum {
  id: string; 
  name: string; 
  album_group: 'album' | 'single' | 'compilation' | 'appears_on';
  album_type: 'album' | 'single' | 'compilation'; 
  release_date?: string; 
  release_date_precision?: string;
  total_tracks?: number; 
  images?: SpotifyImage[]; 
  uri?: string; 
  artists: SpotifyArtist[];
}

export interface SpotifySavedAlbumObject {
  added_at: string;
  album: SpotifyAlbum;
}

export interface GeneratedTrackInfo {
  track: SpotifyTrack;
  sourceType: 'playlist' | 'followedArtistAlbum' | 'followedArtistTopTrack' | 'topArtistSeed';
  sourceName: string;
  sourceAlbumName?: string;
}

// Generic Paging interface for any Spotify resource
export interface SpotifyPagingObject<T> {
  items: T[];
  href: string;
  limit: number;
  next: string | null;
  offset?: number;
  previous?: string | null;
  total?: number;
  cursors?: { after?: string | null; before?: string | null }; 
}

// Specialized paging interfaces
export interface SpotifyArtistPagingObject {
  items: SpotifyArtist[];
  next: string | null;
  cursors?: { after?: string | null };
  limit: number;
  total?: number;
  href: string;
}

export interface SpotifyPlaylistTrackPagingObject {
  items: SpotifyPlaylistTrackObject[];
  next: string | null;
  limit: number;
  offset: number;
  total: number;
  href: string;
}

export interface SpotifyFollowingResponse {
  artists: SpotifyArtistPagingObject;
}

// Type aliases for common responses
export type SpotifyUserPlaylistsResponse = SpotifyPagingObject<SpotifyPlaylist>;
export type SpotifyPlaylistTracksResponse = SpotifyPagingObject<SpotifyPlaylistTrackObject>;
export type SpotifySavedAlbumResponse = SpotifyPagingObject<SpotifySavedAlbumObject>;
export type SpotifyArtistAlbumsResponse = SpotifyPagingObject<SpotifyArtistAlbum>;
export type SpotifyAlbumTracksResponse = SpotifyPagingObject<SpotifyAlbumTrack>;

// User profile model
export interface SpotifyUserProfile {
  id: string;
  display_name: string;
  email?: string;
  images?: SpotifyImage[];
  country?: string;
  product?: 'premium' | 'free';
  followers?: { total: number };
  external_urls?: SpotifyExternalUrls;
}

// Auth related models
export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}