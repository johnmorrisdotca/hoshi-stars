---
title: The Sun on your birthday
section: how-to
order: 6
description: The demo's page that shows which constellation the Sun was really in on a day, such as a birthday, on a chart around it, with the days it went in and came out, and the 13 constellations its path crosses in a year.
---

[日本語](ja/sun-on-a-birthday.md)

The demo's `birthday.html` answers one question: on a given day, which constellation was the Sun really in? Pick a day and it shows the answer, the days the Sun went into that constellation and comes out of it, and a chart of the stars around the Sun: the constellation drawn bright with its boundary, its neighbours, and the Sun's path among the stars over a year (the ecliptic) as a dotted line. Below the chart are the constellations the Sun passes through that year, each with the day it goes in; press one to go to it.

It is real astronomy only. The Sun's path crosses 13 constellations, Ophiuchus among them, and the days it spends in each are not the dates of the traditional twelve signs: the boundaries are the ones the IAU agreed in 1930, and the constellations are not all the same size. The page says so and says nothing more about signs.

## Moving and held

The page opens moving: from today, the Sun steps on one day at a time, four days a second, and the date runs with it, so a year goes by in about a minute and a half. **Pause** holds it on the day shown, and **Play** starts it again from there. A reader who has asked their device for reduced motion gets it still on today, with **Play** ready. Nothing is drawn while the page is out of sight or in a hidden tab.

## The address

| Part | What |
|---|---|
| `date=2020-12-01` | hold it still on that day (year, month, day). Picking a day, pressing one of the year's constellations, or pressing **Pause** writes it. |
| `lang=ja` | the page in Japanese |

With no `date`, the page opens moving from today.

## How it is worked out

- The Sun's place is the low-precision formula of *The Astronomical Almanac* (U.S. Naval Observatory and HM Nautical Almanac Office, section C), good to about 0.01° from 1950 to 2050. The Sun moves that far in about a quarter of an hour.
- The constellation is the package's own `constellationAt`, given the Sun's place of date: it precesses the place to B1875.0 and looks it up in N. G. Roman's table of the IAU boundaries (Delporte, 1930).
- The day it went in and comes out are found by halving the time between a day inside and a day outside until it is down to a minute.
- A day is the reader's own: noon of that day in the browser's time zone. Near a boundary the day can be one off.

The moments are tested against Guy Ottewell's published table for 2020 ("The Sun entering signs and constellations", universalworkshop.com). Both find the same 13 constellations in the same order. His longitudes of the Sun at those moments agree with ours to 0.015°, but the moments differ by up to nine hours: the points where his edges cross the ecliptic are up to 0.33° from those of Roman's table, which hoshi follows and tests against Roman's own positions. So the test asks for each moment to be within half a day of his.
