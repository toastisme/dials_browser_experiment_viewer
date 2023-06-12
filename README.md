# dials_experiment_viewer

An open source tool to view [DIALS](https://github.com/dials/dials) [experiment list (.expt) and reflection (.refl) files](https://dials.github.io/documentation/data_files.html) in the browser without needing a DIALS installation. [Available here.](https://toastisme.github.io/dials_experiment_viewer/)

![dials_experiment_viewer](https://github.com/toastisme/dials_experiment_viewer/blob/0e58b7c16098a8264b8ead8a78a39c2735440ac8/resources/screenshot.png)

## Features
- Drag .expt files into the browser to view the experiment in lab space
- Drag .refl files into the browser to view reflection centroids and bounding boxes in lab space
- Realtime panel coordinates of mouse position
- Hover over indexed reflections to see Miller indices
- Compare calculated reflections of current model against observed reflections

## Limitations
- Currently displays only the first experiment in the .expt file
