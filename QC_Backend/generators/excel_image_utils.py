import io
from copy import deepcopy

from openpyxl.drawing.image import Image as OpenpyxlImage


def copy_worksheet_images(source_sheet, target_sheet):
    """Copy embedded images from a template sheet to an openpyxl-copied sheet."""
    for source_image in getattr(source_sheet, "_images", []):
        image_bytes = io.BytesIO(source_image._data())
        copied_image = OpenpyxlImage(image_bytes)
        copied_image.width = source_image.width
        copied_image.height = source_image.height
        copied_image.anchor = deepcopy(source_image.anchor)
        target_sheet.add_image(copied_image)
