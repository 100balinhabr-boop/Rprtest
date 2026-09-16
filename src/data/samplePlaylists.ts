export interface SamplePlaylist {
  title: string;
  description: string;
  rawM3u: string;
}

export const SAMPLE_PLAYLISTS: SamplePlaylist[] = [
  {
    title: 'Lista Demonstrativa Oficial (Canais & Filmes Legais)',
    description: 'Streams HLS públicos e testados com metadados completos de logos e categorias.',
    rawM3u: `#EXTM3U

#EXTINF:-1 tvg-id="nasa_tv" tvg-name="NASA TV" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/e/e5/NASA_logo.svg" group-title="Ciência & Espaço",NASA TV Live HD
https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8

#EXTINF:-1 tvg-id="redbull_tv" tvg-name="Red Bull TV" tvg-logo="https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/Red_Bull_TV_logo.svg/300px-Red_Bull_TV_logo.svg.png" group-title="Esportes & Ação",Red Bull TV Live
https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8

#EXTINF:-1 tvg-id="bloomberg" tvg-name="Bloomberg Quicktake" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Bloomberg_Quicktake_logo.svg/320px-Bloomberg_Quicktake_logo.svg.png" group-title="Notícias & Economia",Bloomberg Quicktake News
https://bloomberg.com/mediafeeds/live/us.m3u8

#EXTINF:-1 tvg-id="euronews_pt" tvg-name="Euronews Português" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Euronews_logo_2016.svg/320px-Euronews_logo_2016.svg.png" group-title="Notícias & Economia",Euronews (Português)
https://euronews-euronews-portuguese-1-pt.samsung.wurl.tv/playlist.m3u8

#EXTINF:-1 tvg-id="aljazeera_en" tvg-name="Al Jazeera English" tvg-logo="https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Al_Jazeera_English_logo.svg/320px-Al_Jazeera_English_logo.svg.png" group-title="Notícias & Economia",Al Jazeera English HD
https://live-hls-web-aje.getaj.net/AJE/03.m3u8

#EXTINF:-1 tvg-id="big_buck_bunny" tvg-name="Big Buck Bunny" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_buck_bunny_poster_big.jpg/300px-Big_buck_bunny_poster_big.jpg" group-title="Filmes & Animação",Big Buck Bunny (HLS 1080p)
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8

#EXTINF:-1 tvg-id="sintel_movie" tvg-name="Sintel Open Movie" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Sintel_poster.jpg/300px-Sintel_poster.jpg" group-title="Filmes & Animação",Sintel (Filme Completo Blender 4K)
https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8

#EXTINF:-1 tvg-id="tears_of_steel" tvg-name="Tears of Steel" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Tears_of_Steel_poster.jpg/300px-Tears_of_Steel_poster.jpg" group-title="Filmes & Animação",Tears of Steel (Sci-Fi HLS)
https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8

#EXTINF:-1 tvg-id="lofi_chill" tvg-name="Lofi Girl Ambient" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Lofi_girl_logo.jpg/320px-Lofi_girl_logo.jpg" group-title="Música & Rádio",Lofi Radio 24/7 Stream
https://stream.zeno.fm/f3wvbbqmdg8uv`
  }
];
