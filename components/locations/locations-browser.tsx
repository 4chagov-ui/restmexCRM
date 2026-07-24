"use client";

import { useMemo, useState } from "react";
import { LocationCard } from "@/components/locations/location-card";
import { LocationsToolbar } from "@/components/locations/locations-toolbar";
import type { LocationListItem } from "@/lib/db/locations";

type LocationsBrowserProps = {
  locations: LocationListItem[];
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function matchesSearch(location: LocationListItem, search: string) {
  const query = normalize(search);

  if (!query) {
    return true;
  }

  return [
    location.name,
    location.address,
    location.city,
    location.contact,
    location.phone,
    location.notes,
  ].some((value) => normalize(value).includes(query));
}

export function LocationsBrowser({ locations }: LocationsBrowserProps) {
  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState("all");
  const districts = useMemo(
    () =>
      Array.from(
        new Set(
          locations
            .map((location) => location.city?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b, "ru")),
    [locations],
  );
  const filteredLocations = useMemo(
    () =>
      locations.filter((location) => {
        const districtMatches =
          district === "all" || location.city?.trim() === district;

        return districtMatches && matchesSearch(location, search);
      }),
    [district, locations, search],
  );
  const openRequests = filteredLocations.reduce(
    (sum, location) => sum + location.open_requests,
    0,
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:hidden">
        <div className="rounded-3xl border border-slate-950 bg-slate-950 px-5 py-4 text-white shadow-sm shadow-slate-300/60">
          <p className="text-sm text-slate-300">Найдено</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {filteredLocations.length}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white/85 px-5 py-4 text-slate-950 shadow-sm">
          <p className="text-sm text-slate-500">Открытых</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {openRequests}
          </p>
        </div>
      </div>

      <LocationsToolbar
        district={district}
        districts={districts}
        onDistrictChange={setDistrict}
        onSearchChange={setSearch}
        search={search}
      />

      {filteredLocations.length > 0 ? (
        <section className="grid gap-3">
          {filteredLocations.map((location) => (
            <LocationCard key={location.id} location={location} />
          ))}
        </section>
      ) : (
        <section className="rounded-[2rem] border border-dashed border-slate-300 bg-white/85 p-10 text-center shadow-xl shadow-slate-200/50 backdrop-blur">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
            0
          </div>
          <h2 className="mt-5 text-xl font-semibold text-slate-950">
            Заведения не найдены
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
            Измените поиск или фильтр по району. Тестовые данные не используются.
          </p>
        </section>
      )}
    </>
  );
}
