# ADS-B Receiver Hardware Research

> Researched: 2026-06-08
> Context: Hardware needed to capture ADS-B signals for the flight-tracker project (inspired by [skylight](https://github.com/cpaczek/skylight))

## Summary

The best dedicated ADS-B dongle is the **RTL-SDR Blog V4**, and it does appear on two Turkish retailers — but both were out of stock at time of research, likely permanently, as the R828D chip it uses has been discontinued. Cheap DVB-T dongles with R820T2 chipset work as a budget fallback. **Conclusion: these are effectively not findable in Turkey and will likely need to be imported.**

---

## Hardware Options

| Device | Turkish Availability | Price | Notes |
|---|---|---|---|
| **RTL-SDR Blog V4** (R828D + RTL2832U, 24–1766 MHz) | Elektrovadi, Robotzade — out of stock | ~6,082 TRY / ~109 USD | Best dedicated option; globally end-of-line due to R828D chip discontinuation |
| **Generic DVB-T dongle** (R820T/R820T2) | Trendyol, Hepsiburada, n11 as generic TV tuners | ~100–500 TRY | Works at 1090 MHz; lower range/sensitivity; easiest to buy now |
| **FlightAware Pro Stick Plus** | Not stocked in Turkey — import only | ~$35 USD | Built-in LNA + SAW filter (1075–1105 MHz); best sensitivity |

## Turkish Retailers That Have Listed RTL-SDR V4 (Both Out of Stock)

- **Elektrovadi**: https://www.elektrovadi.com/urun/rtl-sdr-blog-v4-rtl2832u-yazilim-tanimli-radyo — 6,082 TRY (TÜKENDI)
- **Robotzade**: https://www.robotzade.com/urun/rtl-sdr-blog-v4-rtl2832u-yazilim-tanimli-radyo-antenler — 5,358 TRY inc-VAT (Stokta Yok)

Both have restock notification buttons — worth signing up if you want to wait.

## Recommended Homelab Software Stack

**[sdr-enthusiasts/docker-adsb-ultrafeeder](https://github.com/sdr-enthusiasts/docker-adsb-ultrafeeder)**
- Runs on `linux/arm/v7`, `linux/arm64`, `linux/amd64`
- Uses Wiedehopf's **readsb** fork as decoder
- RTL-SDR support: set `READSB_DEVICE_TYPE=rtlsdr`

## Import Options (Not Yet Researched)

- FlightAware Pro Stick / Pro Stick Plus from Amazon US/UK
- RTL-SDR Blog V4 or future V5 from rtl-sdr.com directly
- Check Turkey customs implications for SDR hardware before ordering

## Open Questions

- Are R820T2 DVB-T dongles currently in stock on Trendyol/Hepsiburada and at what price?
- Will there be an RTL-SDR V5 to replace the discontinued V4?
- Can FlightAware Pro Stick Plus be imported via Amazon US/UK — Turkey customs for SDR hardware?
- What 1090 MHz outdoor antenna is locally available in Turkey?
