#target photoshop

(function () {
  var previousDialogs = app.displayDialogs;
  var activeDocumentBefore = app.documents.length ? app.activeDocument : null;
  var createdDocument = null;

  function readText(path) {
    var file = new File(path);
    if (!file.exists) throw new Error('Missing job file: ' + path);
    file.encoding = 'UTF8';
    file.open('r');
    var content = file.read();
    file.close();
    return content;
  }

  function writeText(path, content) {
    var file = new File(path);
    file.encoding = 'UTF8';
    file.open('w');
    file.write(content);
    file.close();
  }

  function parseJson(content) {
    return eval('(' + content + ')');
  }

  function quoteJson(value) {
    return '"' + String(value)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t') + '"';
  }

  function color(hex) {
    var value = String(hex).replace('#', '');
    var result = new SolidColor();
    result.rgb.red = parseInt(value.substring(0, 2), 16);
    result.rgb.green = parseInt(value.substring(2, 4), 16);
    result.rgb.blue = parseInt(value.substring(4, 6), 16);
    return result;
  }

  function fillRectangle(document, name, x, y, width, height, fillColor) {
    var layer = document.artLayers.add();
    layer.name = name;
    document.selection.select([[x, y], [x + width, y], [x + width, y + height], [x, y + height]]);
    document.selection.fill(color(fillColor));
    document.selection.deselect();
    return layer;
  }

  function addText(document, name, contents, x, y, size, fillColor) {
    var layer = document.artLayers.add();
    layer.kind = LayerKind.TEXT;
    layer.name = name;
    layer.textItem.contents = contents;
    layer.textItem.position = [x, y];
    layer.textItem.size = size;
    layer.textItem.color = color(fillColor);
    try { layer.textItem.font = 'Arial-BoldMT'; } catch (_) {}
    return layer;
  }

  function placeSmartObject(path) {
    var descriptor = new ActionDescriptor();
    descriptor.putPath(charIDToTypeID('null'), new File(path));
    descriptor.putEnumerated(charIDToTypeID('FTcs'), charIDToTypeID('QCSt'), charIDToTypeID('Qcsa'));
    executeAction(charIDToTypeID('Plc '), descriptor, DialogModes.NO);
    return app.activeDocument.activeLayer;
  }

  function fitLayer(layer, x, y, width, height) {
    var bounds = layer.bounds;
    var layerWidth = bounds[2].as('px') - bounds[0].as('px');
    var layerHeight = bounds[3].as('px') - bounds[1].as('px');
    var scale = Math.min(width / layerWidth, height / layerHeight) * 100;
    layer.resize(scale, scale, AnchorPosition.MIDDLECENTER);
    bounds = layer.bounds;
    var currentLeft = bounds[0].as('px');
    var currentTop = bounds[1].as('px');
    var currentWidth = bounds[2].as('px') - currentLeft;
    var currentHeight = bounds[3].as('px') - currentTop;
    layer.translate(x + (width - currentWidth) / 2 - currentLeft, y + (height - currentHeight) / 2 - currentTop);
  }

  function buildTemplate(spec, palette) {
    var document = app.documents.add(2400, 1600, 72, spec.id, NewDocumentMode.RGB, DocumentFill.WHITE);
    createdDocument = document;
    app.activeDocument = document;
    fillRectangle(document, 'BACKGROUND', 0, 0, 2400, 1600, palette.background);
    fillRectangle(document, 'ACCENT_RULE', 130, 384, 260, 12, palette.accent);
    addText(document, 'BADGE', spec.badge, 130, 105, 28, palette.accent);
    addText(document, 'HEADLINE', spec.headline, 130, 230, 72, palette.text);
    var subheadline = addText(document, 'SUBHEADLINE', 'UNMODIFIED', 130, 330, 34, palette.muted);
    subheadline.textItem.contents = spec.subheadline;
    subheadline.name = 'SUBHEADLINE_MODIFIED';

    var count = spec.renders.length;
    var gap = 36;
    var areaX = 130;
    var areaY = 450;
    var areaWidth = 2140;
    var areaHeight = 1010;
    var cellWidth = count === 1 ? areaWidth : (areaWidth - gap * (count - 1)) / count;
    for (var index = 0; index < count; index += 1) {
      var cellX = areaX + index * (cellWidth + gap);
      fillRectangle(document, 'FRAME_' + (index + 1), cellX, areaY, cellWidth, areaHeight, palette.surface);
      app.activeDocument = document;
      var placed = placeSmartObject(spec.renders[index]);
      placed.name = 'WORKBOOK_RENDER_' + (index + 1);
      fitLayer(placed, cellX + 38, areaY + 38, cellWidth - 76, areaHeight - 76);
    }
    addText(document, 'FOOTER', spec.footer, 130, 1530, 24, palette.muted);

    var psdOptions = new PhotoshopSaveOptions();
    psdOptions.embedColorProfile = true;
    psdOptions.layers = true;
    document.saveAs(new File(spec.psdPath), psdOptions, true, Extension.LOWERCASE);
    var pngOptions = new PNGSaveOptions();
    pngOptions.interlaced = false;
    document.saveAs(new File(spec.pngPath), pngOptions, true, Extension.LOWERCASE);
    document.close(SaveOptions.DONOTSAVECHANGES);
    createdDocument = null;
  }

  try {
    app.displayDialogs = DialogModes.NO;
    if (typeof FPF_JOB_PATH === 'undefined') throw new Error('FPF_JOB_PATH was not provided.');
    var job = parseJson(readText(FPF_JOB_PATH));
    if (!job || !job.items || job.items.length !== 10) throw new Error('Photoshop job must contain exactly ten items.');
    for (var index = 0; index < job.items.length; index += 1) buildTemplate(job.items[index], job.palette);
    writeText(job.resultPath, '{"status":"PASS","route":"PHOTOSHOP_COM_DOJAVASCRIPTFILE","photoshopVersion":' + quoteJson(app.version) + ',"count":' + job.items.length + '}');
  } catch (error) {
    if (createdDocument) {
      try { createdDocument.close(SaveOptions.DONOTSAVECHANGES); } catch (_) {}
    }
    if (typeof FPF_JOB_PATH !== 'undefined') {
      try {
        var failedJob = parseJson(readText(FPF_JOB_PATH));
        writeText(failedJob.resultPath, '{"status":"FAIL","route":"PHOTOSHOP_COM_DOJAVASCRIPTFILE","error":' + quoteJson(error.message || error) + ',"line":' + (error.line || 'null') + '}');
      } catch (_) {}
    }
    throw error;
  } finally {
    app.displayDialogs = previousDialogs;
    if (activeDocumentBefore) {
      try { app.activeDocument = activeDocumentBefore; } catch (_) {}
    }
  }
}());
