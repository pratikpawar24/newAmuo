declare module 'leaflet.markercluster' {
  import * as L from 'leaflet';

  namespace MarkerCluster {
    interface MarkerClusterGroupOptions extends L.LayerOptions {
      maxClusterRadius?: number;
      spiderfyOnMaxZoom?: boolean;
      showCoverageOnHover?: boolean;
      zoomToBoundsOnClick?: boolean;
      iconCreateFunction?: (cluster: MarkerCluster) => L.Icon | L.DivIcon;
    }

    interface MarkerCluster extends L.Marker {
      getChildCount(): number;
    }
  }

  function markerClusterGroup(options?: MarkerCluster.MarkerClusterGroupOptions): L.LayerGroup;
}

declare namespace L {
  function markerClusterGroup(options?: any): LayerGroup;
}
