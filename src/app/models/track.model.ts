export interface Track {
    position:  number;
    title:     string;
    artist:    string;
    album?:    string;     // optional – not present in CSV
    thumbnail: string;
    url:       string;
  }  