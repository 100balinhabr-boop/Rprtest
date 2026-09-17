export interface VodItem {
  id: string;
  title: string;
  originalTitle?: string;
  type: 'movie' | 'series';
  posterUrl: string;
  backdropUrl?: string;
  streamUrl: string;
  rating: number; // e.g. 4.8
  rank?: number; // e.g. 1, 2, 3, 4
  year: number;
  duration?: string; // e.g. "2h 18m" ou "3 Temporadas"
  genre: string;
  category: string;
  synopsis: string;
  badge?: string; // e.g. "4K HDR", "DUBLADO", "UNIVER VIDEO", "NETFLIX"
  episodes?: {
    id: string;
    title: string;
    duration: string;
    streamUrl: string;
    episodeNumber: number;
    seasonNumber: number;
  }[];
}

export const FEATURED_MOVIES: VodItem[] = [
  {
    id: 'feat-noe',
    title: 'NOÉ',
    originalTitle: 'Noah - Uma Adaptação da Novela Gênesis',
    type: 'movie',
    posterUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    backdropUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
    streamUrl: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
    rating: 4.9,
    rank: 4,
    year: 2024,
    duration: '2h 18m',
    genre: 'Épico / Drama',
    category: 'Lançamentos',
    synopsis: 'Uma adaptação épica e cinematográfica que retrata a jornada de fé, desafios e esperança em meio a uma das maiores narrativas bíblicas da humanidade.',
    badge: 'UNIVER VIDEO'
  },
  {
    id: 'feat-chamas',
    title: 'Chamas da Vingança',
    originalTitle: 'Man on Fire',
    type: 'movie',
    posterUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80',
    backdropUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80',
    streamUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    rating: 3.8,
    rank: 1,
    year: 2024,
    duration: '2h 26m',
    genre: 'Ação / Suspense',
    category: 'Ação',
    synopsis: 'Um ex-agente do governo recebe a missão de proteger uma jovem contra perigosas organizações, desencadeando uma caçada implacável.',
    badge: '4K HDR'
  },
  {
    id: 'feat-vinganca-fatal',
    title: 'Vingança Fatal',
    originalTitle: 'Deadly Retribution',
    type: 'movie',
    posterUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80',
    backdropUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
    streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    rating: 3.1,
    rank: 2,
    year: 2023,
    duration: '1h 54m',
    genre: 'Ação / Policial',
    category: 'Ação',
    synopsis: 'Nas ruas movimentadas de uma metrópole dividida, dois justiceiros se unem para combater uma rede clandestina.',
    badge: 'DUBLADO'
  },
  {
    id: 'feat-nostalgia',
    title: 'Nostalgia Ciência: Cosmos',
    originalTitle: 'Cosmos & Beyond',
    type: 'movie',
    posterUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
    backdropUrl: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1200&q=80',
    streamUrl: 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8',
    rating: 4.7,
    rank: 3,
    year: 2024,
    duration: '1h 45m',
    genre: 'Documentário',
    category: 'Documentários',
    synopsis: 'Uma viagem espetacular através das estrelas, explorando mistérios cósmicos e a evolução do nosso universo.',
    badge: '4K UHD'
  }
];

export const SAMPLE_MOVIES: VodItem[] = [
  ...FEATURED_MOVIES,
  {
    id: 'mov-historia',
    title: 'Uma História Quase de Amor',
    originalTitle: 'Almost Love',
    type: 'movie',
    posterUrl: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=800&q=80',
    streamUrl: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
    rating: 3.6,
    year: 2023,
    duration: '1h 48m',
    genre: 'Romance / Comédia',
    category: 'Romance',
    synopsis: 'Dois desconhecidos se encontram por acaso durante as festividades de fim de ano e descobrem afinidades inesperadas.',
    badge: 'HD'
  },
  {
    id: 'mov-resgate-natal',
    title: 'Um Voo no Natal',
    originalTitle: 'Holiday Flight',
    type: 'movie',
    posterUrl: 'https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=800&q=80',
    streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    rating: 3.0,
    year: 2022,
    duration: '1h 35m',
    genre: 'Comédia / Família',
    category: 'Comédia',
    synopsis: 'Passageiros de um voo cancelado na véspera de Natal se unem para comemorar em terra firme.',
    badge: 'DUBLADO'
  },
  {
    id: 'mov-sintel',
    title: 'Sintel: Em Busca do Dragão',
    originalTitle: 'Sintel',
    type: 'movie',
    posterUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Sintel_poster.jpg/300px-Sintel_poster.jpg',
    streamUrl: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
    rating: 4.8,
    year: 2024,
    duration: '1h 20m',
    genre: 'Animação / Fantasia',
    category: 'Animação',
    synopsis: 'Uma garota solitária resgata um pequeno filhote de dragão, criando um vínculo inquebrável que atravessa terras desconhecidas.',
    badge: 'BLENDER 4K'
  },
  {
    id: 'mov-tears-steel',
    title: 'Tears of Steel: Rebelião Cibernética',
    originalTitle: 'Tears of Steel',
    type: 'movie',
    posterUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Tears_of_Steel_poster.jpg/300px-Tears_of_Steel_poster.jpg',
    streamUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    rating: 4.5,
    year: 2023,
    duration: '1h 15m',
    genre: 'Ficção Científica',
    category: 'Ficção Científica',
    synopsis: 'Em um futuro distópico dominado por androides em Amsterdã, cientistas tentam recuperar memórias cruciais.',
    badge: 'SCI-FI 4K'
  },
  {
    id: 'mov-big-buck',
    title: 'Big Buck Bunny: A Grande Aventura',
    originalTitle: 'Big Buck Bunny',
    type: 'movie',
    posterUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_buck_bunny_poster_big.jpg/300px-Big_buck_bunny_poster_big.jpg',
    streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    rating: 4.3,
    year: 2022,
    duration: '1h 10m',
    genre: 'Animação / Família',
    category: 'Animação',
    synopsis: 'Um coelho gigante e tranquilo decide dar uma lição bem-humorada em três arruaceiros da floresta.',
    badge: 'FULL HD'
  },
  {
    id: 'mov-redbull-action',
    title: 'Red Bull: Fronteiras da Adrenalina',
    originalTitle: 'Red Bull Action Sports',
    type: 'movie',
    posterUrl: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=800&q=80',
    streamUrl: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8',
    rating: 4.9,
    year: 2024,
    duration: '2h 05m',
    genre: 'Ação / Esportes',
    category: 'Ação',
    synopsis: 'Os maiores atletas radicais do mundo desafiam picos nevados, penhascos e ondas monstruosas.',
    badge: '4K EXTREME'
  }
];

export const SAMPLE_SERIES: VodItem[] = [
  {
    id: 'ser-fazenda',
    title: 'A Fazenda 18',
    originalTitle: 'A Fazenda - O Confinamento',
    type: 'series',
    posterUrl: 'https://images.unsplash.com/photo-1500595046743-cd271d694d30?auto=format&fit=crop&w=800&q=80',
    backdropUrl: 'https://images.unsplash.com/photo-1500595046743-cd271d694d30?auto=format&fit=crop&w=1200&q=80',
    streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    rating: 4.6,
    rank: 1,
    year: 2024,
    duration: 'Temporada 18',
    genre: 'Reality Show',
    category: 'Reality',
    synopsis: 'Confinamento rural com celebridades disputando provas acirradas, votos do público e o grande prêmio milionário.',
    badge: 'AO VIVO 24H',
    episodes: [
      { id: 'ep1', title: 'Episódio 01 - A Estreia & Divisão da Baia', duration: '52m', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', episodeNumber: 1, seasonNumber: 18 },
      { id: 'ep2', title: 'Episódio 02 - Prova de Fogo & Conflitos', duration: '48m', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', episodeNumber: 2, seasonNumber: 18 },
      { id: 'ep3', title: 'Episódio 03 - Votação Aberta & Roça', duration: '55m', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', episodeNumber: 3, seasonNumber: 18 }
    ]
  },
  {
    id: 'ser-globo-novela',
    title: 'Renascer: A Grande Saga',
    originalTitle: 'Renascer',
    type: 'series',
    posterUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    backdropUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
    streamUrl: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
    rating: 4.8,
    rank: 2,
    year: 2024,
    duration: '120 Capítulos',
    genre: 'Novela / Drama',
    category: 'Novelas',
    synopsis: 'A saga de José Inocêncio, um homem obstinado que constrói um império de cacau na Bahia sob a proteção de um jequitibá-rei.',
    badge: 'GLOBOPLAY 4K',
    episodes: [
      { id: 'nov1', title: 'Capítulo 01 - O Pacto no Jequitibá', duration: '58m', streamUrl: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8', episodeNumber: 1, seasonNumber: 1 },
      { id: 'nov2', title: 'Capítulo 02 - O Amor Proibido', duration: '50m', streamUrl: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8', episodeNumber: 2, seasonNumber: 1 },
      { id: 'nov3', title: 'Capítulo 03 - O Florescer do Cacau', duration: '54m', streamUrl: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8', episodeNumber: 3, seasonNumber: 1 }
    ]
  },
  {
    id: 'ser-stranger',
    title: 'O Enigma do Vale Perdido',
    originalTitle: 'Lost Valley Mystery',
    type: 'series',
    posterUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
    streamUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    rating: 4.7,
    rank: 3,
    year: 2024,
    duration: '2 Temporadas',
    genre: 'Suspense / Mistério',
    category: 'Séries',
    synopsis: 'Quando sinais estranhos começam a ecoar de uma floresta isolada, um grupo de jovens desvenda segredos governamentais.',
    badge: 'NETFLIX',
    episodes: [
      { id: 'ep10', title: 'S01E01 - O Primeiro Sinal', duration: '49m', streamUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8', episodeNumber: 1, seasonNumber: 1 },
      { id: 'ep11', title: 'S01E02 - O Laboratório Subterrâneo', duration: '51m', streamUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8', episodeNumber: 2, seasonNumber: 1 }
    ]
  },
  {
    id: 'ser-cosmos',
    title: 'Planeta Selvagem: Horizontes',
    originalTitle: 'Wild Earth Horizons',
    type: 'series',
    posterUrl: 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?auto=format&fit=crop&w=800&q=80',
    streamUrl: 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8',
    rating: 4.9,
    rank: 4,
    year: 2023,
    duration: '6 Episódios',
    genre: 'Natureza / Documentário',
    category: 'Documentários',
    synopsis: 'Imagens impressionantes em altíssima definição dos ecossistemas mais selvagens e intocados do planeta.',
    badge: 'DISCOVERY'
  }
];
