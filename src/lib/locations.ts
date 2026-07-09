export interface KenyanLocation {
  name: string;
  city: string; // The parent city/county
  latitude: number;
  longitude: number;
}

export const KENYAN_LOCATIONS: KenyanLocation[] = [
  // Nairobi and Neighborhoods
  { name: 'Nairobi CBD', city: 'Nairobi', latitude: -1.2833, longitude: 36.8233 },
  { name: 'Westlands, Nairobi', city: 'Nairobi', latitude: -1.2616, longitude: 36.8028 },
  { name: 'Kilimani, Nairobi', city: 'Nairobi', latitude: -1.2906, longitude: 36.7903 },
  { name: 'Karen, Nairobi', city: 'Nairobi', latitude: -1.3201, longitude: 36.7029 },
  { name: 'Lang\'ata, Nairobi', city: 'Nairobi', latitude: -1.3414, longitude: 36.7876 },
  { name: 'Kasarani, Nairobi', city: 'Nairobi', latitude: -1.2217, longitude: 36.8983 },
  { name: 'Roysambu, Nairobi', city: 'Nairobi', latitude: -1.2185, longitude: 36.8901 },
  { name: 'Embakasi, Nairobi', city: 'Nairobi', latitude: -1.3197, longitude: 36.9056 },
  { name: 'Eastleigh, Nairobi', city: 'Nairobi', latitude: -1.2755, longitude: 36.8488 },
  { name: 'Madaraka, Nairobi', city: 'Nairobi', latitude: -1.3069, longitude: 36.8143 },
  { name: 'South C, Nairobi', city: 'Nairobi', latitude: -1.3229, longitude: 36.8288 },
  { name: 'South B, Nairobi', city: 'Nairobi', latitude: -1.3135, longitude: 36.8415 },
  { name: 'Parklands, Nairobi', city: 'Nairobi', latitude: -1.2589, longitude: 36.8159 },
  { name: 'Gigiri, Nairobi', city: 'Nairobi', latitude: -1.2333, longitude: 36.8042 },
  { name: 'Runda, Nairobi', city: 'Nairobi', latitude: -1.2017, longitude: 36.7997 },
  { name: 'Lavington, Nairobi', city: 'Nairobi', latitude: -1.2789, longitude: 36.7725 },
  { name: 'Hurlingham, Nairobi', city: 'Nairobi', latitude: -1.2933, longitude: 36.7975 },

  // Nairobi Metropolitan Area (Kiambu, Machakos, Kajiado)
  { name: 'Ngong', city: 'Kajiado', latitude: -1.3614, longitude: 36.6567 },
  { name: 'Ongata Rongai', city: 'Kajiado', latitude: -1.3969, longitude: 36.7214 },
  { name: 'Kitengela', city: 'Kajiado', latitude: -1.4800, longitude: 36.9600 },
  { name: 'Kajiado Town', city: 'Kajiado', latitude: -1.8524, longitude: 36.7768 },
  { name: 'Ruiru', city: 'Kiambu', latitude: -1.1500, longitude: 36.9500 },
  { name: 'Thika', city: 'Kiambu', latitude: -1.0396, longitude: 37.0900 },
  { name: 'Kiambu Town', city: 'Kiambu', latitude: -1.1620, longitude: 36.8310 },
  { name: 'Syokimau', city: 'Machakos', latitude: -1.3688, longitude: 36.9388 },
  { name: 'Athi River', city: 'Machakos', latitude: -1.4500, longitude: 36.9833 },
  { name: 'Machakos Town', city: 'Machakos', latitude: -1.5177, longitude: 37.2634 },

  // Mombasa and Coastal Region
  { name: 'Mombasa Island', city: 'Mombasa', latitude: -4.0500, longitude: 39.6600 },
  { name: 'Nyali, Mombasa', city: 'Mombasa', latitude: -4.0294, longitude: 39.7118 },
  { name: 'Bamburi, Mombasa', city: 'Mombasa', latitude: -3.9922, longitude: 39.7225 },
  { name: 'Likoni, Mombasa', city: 'Mombasa', latitude: -4.0926, longitude: 39.6644 },
  { name: 'Tudor, Mombasa', city: 'Mombasa', latitude: -4.0375, longitude: 39.6705 },
  { name: 'Kisauni, Mombasa', city: 'Mombasa', latitude: -4.0272, longitude: 39.6836 },
  { name: 'Changamwe, Mombasa', city: 'Mombasa', latitude: -4.0197, longitude: 39.6300 },
  { name: 'Mtwapa', city: 'Kilifi', latitude: -3.9431, longitude: 39.7431 },
  { name: 'Malindi', city: 'Kilifi', latitude: -3.2175, longitude: 40.1191 },
  { name: 'Voi', city: 'Taita Taveta', latitude: -3.3975, longitude: 38.5559 },
  { name: 'Lamu Town', city: 'Lamu', latitude: -2.2686, longitude: 40.9006 },

  // Rift Valley Region
  { name: 'Nakuru CBD', city: 'Nakuru', latitude: -0.3031, longitude: 36.0800 },
  { name: 'Naka, Nakuru', city: 'Nakuru', latitude: -0.3015, longitude: 36.1085 },
  { name: 'Milimani, Nakuru', city: 'Nakuru', latitude: -0.2882, longitude: 36.0722 },
  { name: 'Lanet, Nakuru', city: 'Nakuru', latitude: -0.2981, longitude: 36.1478 },
  { name: 'Kiamunyi, Nakuru', city: 'Nakuru', latitude: -0.2798, longitude: 36.0354 },
  { name: 'Naivasha', city: 'Nakuru', latitude: -0.7172, longitude: 36.4310 },
  { name: 'Eldoret CBD', city: 'Uasin Gishu', latitude: 0.5143, longitude: 35.2697 },
  { name: 'Elgon View, Eldoret', city: 'Uasin Gishu', latitude: 0.4950, longitude: 35.2680 },
  { name: 'Kapsoya, Eldoret', city: 'Uasin Gishu', latitude: 0.5281, longitude: 35.3023 },
  { name: 'Pioneer, Eldoret', city: 'Uasin Gishu', latitude: 0.5015, longitude: 35.2575 },
  { name: 'Kitale', city: 'Trans Nzoia', latitude: 1.0191, longitude: 35.0023 },
  { name: 'Kericho', city: 'Kericho', latitude: -0.3692, longitude: 35.2839 },
  { name: 'Nanyuki', city: 'Laikipia', latitude: 0.0167, longitude: 37.0728 },
  { name: 'Narok Town', city: 'Narok', latitude: -1.0784, longitude: 35.8601 },

  // Nyanza & Western Region
  { name: 'Kisumu CBD', city: 'Kisumu', latitude: -0.0917, longitude: 34.7680 },
  { name: 'Milimani, Kisumu', city: 'Kisumu', latitude: -0.1042, longitude: 34.7578 },
  { name: 'Riat Hills, Kisumu', city: 'Kisumu', latitude: -0.0522, longitude: 34.7833 },
  { name: 'Kondele, Kisumu', city: 'Kisumu', latitude: -0.0825, longitude: 34.7831 },
  { name: 'Nyamasaria, Kisumu', city: 'Kisumu', latitude: -0.1189, longitude: 34.7981 },
  { name: 'Kisii Town', city: 'Kisii', latitude: -0.6773, longitude: 34.7796 },
  { name: 'Kakamega Town', city: 'Kakamega', latitude: 0.2827, longitude: 34.7519 },
  { name: 'Bungoma Town', city: 'Bungoma', latitude: 0.5636, longitude: 34.5606 },
  { name: 'Busia Town', city: 'Busia', latitude: 0.4608, longitude: 34.1115 },

  // Central & Eastern Region
  { name: 'Nyeri Town', city: 'Nyeri', latitude: -0.4220, longitude: 36.9476 },
  { name: 'Meru Town', city: 'Meru', latitude: 0.0515, longitude: 37.6456 },
  { name: 'Embu Town', city: 'Embu', latitude: -0.5312, longitude: 37.4510 },
  { name: 'Kitui Town', city: 'Kitui', latitude: -1.3750, longitude: 38.0167 },

  // Northern Region
  { name: 'Garissa Town', city: 'Garissa', latitude: -0.4532, longitude: 39.6461 },
  { name: 'Wajir Town', city: 'Wajir', latitude: 1.7471, longitude: 40.0573 },
  { name: 'Marsabit Town', city: 'Marsabit', latitude: 2.3284, longitude: 37.9902 },
  { name: 'Lodwar Town', city: 'Turkana', latitude: 3.1190, longitude: 35.5973 }
];

/**
 * Calculates distance in kilometers between two points using the Haversine formula
 */
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10; // Round to 1 decimal place
}

/**
 * Returns coordinates for a specific Kenyan location name
 */
export function getLocationCoordinates(locationName: string): { latitude: number; longitude: number } | null {
  const loc = KENYAN_LOCATIONS.find(
    (l) => l.name.toLowerCase() === locationName.trim().toLowerCase()
  );
  if (loc) {
    return { latitude: loc.latitude, longitude: loc.longitude };
  }
  return null;
}

/**
 * Finds the nearest predefined Kenyan location from raw GPS coordinates
 */
export function getNearestKenyanCity(lat: number, lon: number): KenyanLocation {
  let nearestLoc = KENYAN_LOCATIONS[0];
  let minDistance = getDistanceKm(lat, lon, nearestLoc.latitude, nearestLoc.longitude);

  for (let i = 1; i < KENYAN_LOCATIONS.length; i++) {
    const dist = getDistanceKm(lat, lon, KENYAN_LOCATIONS[i].latitude, KENYAN_LOCATIONS[i].longitude);
    if (dist < minDistance) {
      minDistance = dist;
      nearestLoc = KENYAN_LOCATIONS[i];
    }
  }

  return nearestLoc;
}
