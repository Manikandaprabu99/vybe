import { getRadioStations } from '@/lib/radio';
import { Track } from '@/lib/types';
import RadioView from '@/components/RadioView';

// Station lists are fetched when the site is built (on every push and on the
// schedule in .github/workflows/deploy.yml) — they barely change, and Radio
// Browser asks apps to go easy on its volunteer-run servers.
async function safe(promise: Promise<Track[]>): Promise<Track[]> {
  try {
    return await promise;
  } catch (err) {
    console.error('Radio list failed to load', err);
    return [];
  }
}

export default async function RadioPage() {
  const [tamil, english] = await Promise.all([safe(getRadioStations('tamil', 40)), safe(getRadioStations('english', 30))]);
  return <RadioView tamil={tamil} english={english} />;
}
