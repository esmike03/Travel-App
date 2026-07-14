// Ported verbatim from previewDestinations in ui/screens/Screens.kt.

export interface Destination {
  id: number;
  name: string;
  municipality: string;
  location: string;
  category: string;
  imageUrl: string;
  rating: string;
  latitude: number;
  longitude: number;
  shortDescription: string;
  bestTimeToVisit: string;
  sourceUrl: string;
}

const DEFAULT_SOURCE = 'https://www.journeyera.com/things-to-do-bohol/';

export const destinations: Destination[] = [
  {
    id: 1,
    name: 'Dimiao Twin Falls (Pahangog Falls)',
    municipality: 'Dimiao',
    location: 'Dimiao, Bohol',
    category: 'Waterfall',
    imageUrl:
      'https://www.journeyera.com/wp-content/uploads/2016/10/waterfall-bohol-03731-1024x683.jpg',
    rating: '4.8',
    latitude: 9.6106,
    longitude: 124.1594,
    shortDescription:
      'A twin-stream waterfall with a jungle setting, natural pools, and cliff-jump spots where depth should be checked carefully.',
    bestTimeToVisit: 'Morning or late afternoon',
    sourceUrl: DEFAULT_SOURCE,
  },
  {
    id: 2,
    name: 'Can-Umantad Falls',
    municipality: 'Candijay',
    location: 'Candijay, Bohol',
    category: 'Waterfall',
    imageUrl:
      'https://www.journeyera.com/wp-content/uploads/2019/05/can-umantad-falls-candijay-bohol-2726124A2726.jpg',
    rating: '4.7',
    latitude: 9.833,
    longitude: 124.497,
    shortDescription:
      'A tall waterfall near Candijay with bright blue pools and nearby countryside stops.',
    bestTimeToVisit: 'After light rain, during daylight',
    sourceUrl: DEFAULT_SOURCE,
  },
  {
    id: 3,
    name: 'Panglao Beach Sunset',
    municipality: 'Panglao',
    location: 'Panglao, Bohol',
    category: 'Beach',
    imageUrl:
      'https://www.journeyera.com/wp-content/uploads/2019/01/tourist-spots-in-bohol-2346124A2346.jpg',
    rating: '4.7',
    latitude: 9.578,
    longitude: 123.7458,
    shortDescription:
      'A quiet sunset beach area on Panglao with calm water, palm trees, and reflective shoreline views.',
    bestTimeToVisit: 'Sunset',
    sourceUrl: DEFAULT_SOURCE,
  },
  {
    id: 4,
    name: 'Camugao Waterfall',
    municipality: 'Balilihan',
    location: 'Balilihan, Bohol',
    category: 'Waterfall',
    imageUrl:
      'https://www.journeyera.com/wp-content/uploads/2019/05/CAMUGAO-FALLS-BOHOL-2314124A2314.jpg',
    rating: '4.6',
    latitude: 9.7542,
    longitude: 123.9728,
    shortDescription:
      'A forest waterfall reached by a short but steep walk, with a dramatic drop and greenery around the pool.',
    bestTimeToVisit: 'Morning',
    sourceUrl: DEFAULT_SOURCE,
  },
  {
    id: 5,
    name: 'Mag-Aso Falls',
    municipality: 'Antequera',
    location: 'Antequera, Bohol',
    category: 'Waterfall',
    imageUrl:
      'https://www.journeyera.com/wp-content/uploads/2019/05/MAG-ASO-FALLS-BOHOL-2078124A2078.jpg',
    rating: '4.6',
    latitude: 9.7794,
    longitude: 123.9018,
    shortDescription:
      'A refreshing waterfall near Antequera with an easy entrance and a short walk down to the falls.',
    bestTimeToVisit: 'Morning',
    sourceUrl: DEFAULT_SOURCE,
  },
  {
    id: 6,
    name: 'Cadapdapan Rice Terraces',
    municipality: 'Candijay',
    location: 'Candijay, Bohol',
    category: 'Nature',
    imageUrl:
      'https://www.journeyera.com/wp-content/uploads/2019/05/cadapdapan-rice-terraces-candijay-bohol-0552DJI_0552.jpg',
    rating: '4.8',
    latitude: 9.8219,
    longitude: 124.5102,
    shortDescription:
      'Layered rice terraces in Candijay with wide views, nearby falls, and a quiet rural feel.',
    bestTimeToVisit: 'Early morning or golden hour',
    sourceUrl: DEFAULT_SOURCE,
  },
  {
    id: 7,
    name: 'Panglao Beach',
    municipality: 'Panglao',
    location: 'Panglao, Bohol',
    category: 'Beach',
    imageUrl:
      'https://www.journeyera.com/wp-content/uploads/2019/01/tourist-spots-in-bohol-1840124A1840.jpg',
    rating: '4.6',
    latitude: 9.5762,
    longitude: 123.7447,
    shortDescription:
      'A palm-lined stretch of Panglao coastline suited for slow exploring, swimming, and relaxed beach time.',
    bestTimeToVisit: 'Morning or sunset',
    sourceUrl: DEFAULT_SOURCE,
  },
  {
    id: 8,
    name: 'Mayana Peak',
    municipality: 'Jagna',
    location: 'Mayana, Jagna, Bohol',
    category: 'Hike',
    imageUrl:
      'https://www.journeyera.com/wp-content/uploads/2019/01/tourist-spots-in-bohol-1661124A1661.jpg',
    rating: '4.5',
    latitude: 9.7225,
    longitude: 124.355,
    shortDescription:
      'A short highland trek reached by motorbike, offering mountain views over central Bohol.',
    bestTimeToVisit: 'Sunrise or late afternoon',
    sourceUrl: DEFAULT_SOURCE,
  },
  {
    id: 9,
    name: 'Alexis Cliff Dive Resort / Molave Cove',
    municipality: 'Panglao',
    location: 'Panglao, Bohol',
    category: 'Cliff jump',
    imageUrl:
      'https://www.journeyera.com/wp-content/uploads/2019/05/cliff-jumping-bohol-philippines-1602124A1602.jpg',
    rating: '4.5',
    latitude: 9.5548,
    longitude: 123.7775,
    shortDescription:
      'A popular Panglao cliff-jumping spot with clear water and easier access than many hidden coastal jumps.',
    bestTimeToVisit: 'Calm seas and daylight',
    sourceUrl: DEFAULT_SOURCE,
  },
  {
    id: 10,
    name: 'Binabaje Hills Sunrise Trek',
    municipality: 'Alicia',
    location: 'Alicia, Bohol',
    category: 'Hike',
    imageUrl:
      'https://www.journeyera.com/wp-content/uploads/2019/05/binabaje-hills-in-alicia-bohol-0587DJI_0587.jpg',
    rating: '4.8',
    latitude: 9.894,
    longitude: 124.455,
    shortDescription:
      'A steep sunrise hike in Alicia with rolling hills and wide countryside views.',
    bestTimeToVisit: 'Sunrise',
    sourceUrl: DEFAULT_SOURCE,
  },
  {
    id: 11,
    name: 'Kinahugan Falls',
    municipality: 'Jagna',
    location: 'Jagna, Bohol',
    category: 'Waterfall',
    imageUrl:
      'https://www.journeyera.com/wp-content/uploads/2019/01/cliff-jumping-bohol-philippines-1802124A1802.jpg',
    rating: '4.4',
    latitude: 9.7068,
    longitude: 124.3631,
    shortDescription:
      'A quieter local waterfall stop near rice fields and villages around Jagna.',
    bestTimeToVisit: 'Morning or early afternoon',
    sourceUrl: DEFAULT_SOURCE,
  },
  {
    id: 12,
    name: 'Rice Fields near Mayana',
    municipality: 'Jagna',
    location: 'Mayana, Jagna, Bohol',
    category: 'Nature',
    imageUrl:
      'https://www.journeyera.com/wp-content/uploads/2019/01/tourist-spots-in-bohol-DJI_0446-Pano.jpg',
    rating: '4.4',
    latitude: 9.7194,
    longitude: 124.35,
    shortDescription:
      'Scenic rice fields and mountain views around Mayana, ideal for slow drives and photo stops.',
    bestTimeToVisit: 'Golden hour',
    sourceUrl: DEFAULT_SOURCE,
  },
  {
    id: 13,
    name: 'Lonoy Cold Spring',
    municipality: 'Jagna',
    location: 'Lonoy, Jagna, Bohol',
    category: 'Spring',
    imageUrl:
      'https://www.journeyera.com/wp-content/uploads/2019/01/tourist-spots-in-bohol-1735124A1735.jpg',
    rating: '4.3',
    latitude: 9.7049,
    longitude: 124.36,
    shortDescription:
      'A local cold spring near Mayana where visitors can cool down after exploring inland Bohol.',
    bestTimeToVisit: 'Midday',
    sourceUrl: DEFAULT_SOURCE,
  },
  {
    id: 14,
    name: 'Anda White Beach',
    municipality: 'Anda',
    location: 'Anda, Bohol',
    category: 'Beach',
    imageUrl:
      'https://www.journeyera.com/wp-content/uploads/2019/01/tourist-spots-in-bohol-2604124A2604.jpg',
    rating: '4.8',
    latitude: 9.7462,
    longitude: 124.5765,
    shortDescription:
      'A quieter white-sand beach area in Anda with palm-lined coast and a calmer pace than Panglao.',
    bestTimeToVisit: 'Morning or sunset',
    sourceUrl: DEFAULT_SOURCE,
  },
  {
    id: 15,
    name: 'Canawa Cold Spring',
    municipality: 'Candijay',
    location: 'Candijay, Bohol',
    category: 'Spring',
    imageUrl:
      'https://www.journeyera.com/wp-content/uploads/2019/05/CANAWA-COLD-SPRING-CANDIJAY-BOHOL-2802124A2802.jpg',
    rating: '4.5',
    latitude: 9.819,
    longitude: 124.506,
    shortDescription:
      'A deep blue cold spring in Candijay that works well as a refreshing stop before or after Anda.',
    bestTimeToVisit: 'Midday',
    sourceUrl: DEFAULT_SOURCE,
  },
  {
    id: 16,
    name: 'Can-Uba Beach',
    municipality: 'Jagna',
    location: 'Jagna, Bohol',
    category: 'Beach',
    imageUrl:
      'https://www.journeyera.com/wp-content/uploads/2019/01/tourist-spots-in-bohol-1824124A1824.jpg',
    rating: '4.6',
    latitude: 9.6478,
    longitude: 124.3665,
    shortDescription:
      'A peaceful rocky beach near Jagna, lined with palms and better suited for scenic stops than soft-sand lounging.',
    bestTimeToVisit: 'Sunset',
    sourceUrl: DEFAULT_SOURCE,
  },
];

export function destinationById(id: number): Destination | undefined {
  return destinations.find((d) => d.id === id);
}

// Haversine distance in km — replaces android.location.Location.distanceBetween.
export function distanceKm(
  from: { latitude: number; longitude: number },
  dest: { latitude: number; longitude: number }
): number {
  const R = 6371;
  const dLat = ((dest.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((dest.longitude - from.longitude) * Math.PI) / 180;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (dest.latitude * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
