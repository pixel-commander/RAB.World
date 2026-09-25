Temporary marker: data-rab-kit-class="container-main" on a JSX opening tag.
With seeded=true, add that token to a literal className and remove the marker.
With seeded=false, remove only the marker. Keep data-area and data-rab-seat.
Unknown data-rab-kit-* markers or non-literal className values fail closed.
