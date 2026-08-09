/**
 * The two landings' `<title>`, description and canonical, composed here rather than in the route.
 *
 * ┌─ WHY THIS LEFT `app/` ──────────────────────────────────────────────────────────────────────┐
 * │ `F1` is that `app/` is routing only, and this is the one piece of these routes that is not   │
 * │ routing: it decides what a search engine reads. It also could not be tested where it was.    │
 * │                                                                                              │
 * │ `landings.spec.ts` asserted "no two landings share a title" by building `city:Bengaluru` and │
 * │ `activity:Yoga` - strings it invented, one per landing, distinct by construction - and then  │
 * │ checking the count. It read no title at all, so two landings could have shipped identical    │
 * │ metadata and it would have passed. Importing the route to fix that fails: the test runner    │
 * │ strips types from `.ts` and cannot load a `.tsx`.                                             │
 * │                                                                                              │
 * │ A `.ts` module both the route and the test import solves both problems at once, which is     │
 * │ usually the sign the code was in the wrong place rather than the test being awkward.          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { t } from '../../shared/i18n/index.ts';
import { activityLanding, cityLanding } from './landings.ts';

/** What a route needs to hand to Next, with no Next types in the way. */
export interface LandingMetadata {
  readonly title: string;
  readonly description?: string;
  readonly canonical?: string;
}

/** The title a slug that resolves to nothing gets, so a 404 is not an untitled tab. */
function missing(): LandingMetadata {
  return { title: `${t('web.gym.notFound.title')} · GymMap` };
}

export function cityLandingMetadata(citySlug: string): LandingMetadata {
  const landing = cityLanding(citySlug);
  if (landing === null) return missing();

  return {
    title: `${t('web.landing.city.title').replace('{city}', landing.name)} · GymMap`,
    description: t('web.landing.city.metaDescription').replace('{city}', landing.name),
    /*
     * One canonical per place. Without it `/gyms/bengaluru` and `/search?city=bengaluru` compete
     * for the same results and a search engine picks - usually the one with less copy on it.
     */
    canonical: `/gyms/${landing.slug}`,
  };
}

export function activityLandingMetadata(activitySlug: string): LandingMetadata {
  const landing = activityLanding(activitySlug);
  if (landing === null) return missing();

  return {
    title: `${t('web.landing.activity.title').replace('{activity}', landing.name)} · GymMap`,
    description: t('web.landing.activity.metaDescription').replace('{activity}', landing.name),
    canonical: `/explore/${landing.slug}`,
  };
}
