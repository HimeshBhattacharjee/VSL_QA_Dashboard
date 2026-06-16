import io
from copy import deepcopy

from openpyxl.drawing.image import Image as OpenpyxlImage


def collect_worksheet_images(source_sheet):
    """Read embedded image bytes before openpyxl copy_worksheet closes image streams."""
    image_specs = []
    for source_image in getattr(source_sheet, "_images", []):
        image_specs.append({
            "data": source_image._data(),
            "width": source_image.width,
            "height": source_image.height,
            "anchor": deepcopy(source_image.anchor),
        })
    return image_specs


def add_worksheet_images(target_sheet, image_specs):
    for image_spec in image_specs:
        copied_image = OpenpyxlImage(io.BytesIO(image_spec["data"]))
        copied_image.width = image_spec["width"]
        copied_image.height = image_spec["height"]
        copied_image.anchor = deepcopy(image_spec["anchor"])
        target_sheet.add_image(copied_image)


def copy_worksheet_images(source_sheet, target_sheet):
    """Copy embedded images from a template sheet to an openpyxl-copied sheet."""
    add_worksheet_images(target_sheet, collect_worksheet_images(source_sheet))
