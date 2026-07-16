using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using RevitLicense.App;
using RevitLicense.License;

namespace RevitLicense.Commands
{
    /// <summary>
    /// Sample ARC command. Requires the ARC (Kiến trúc) discipline. The base
    /// class gates on the license before ExecuteCommand runs and logs telemetry.
    /// </summary>
    [Transaction(TransactionMode.Manual)]
    [Regeneration(RegenerationOption.Manual)]
    [RequiresProduct("ARC")]
    public class WallDimensionCommand : CommandBase
    {
        protected override string CommandId => "ARC.WallDimension";

        protected override Result ExecuteCommand(
            ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            // Placeholder for the real "auto dimension walls" logic.
            // TODO(Windows dev): implement against the active document / selection.
            // var uidoc = commandData.Application.ActiveUIDocument;
            // var doc = uidoc.Document; ...

            TaskDialog.Show("ARC — Ghi kích thước tường",
                "License bộ môn Kiến trúc (ARC) hợp lệ. Lệnh ghi kích thước tường sẽ chạy ở đây.");
            return Result.Succeeded;
        }
    }

    /// <summary>
    /// Sample STR command. Requires the STR (Kết cấu) discipline.
    /// </summary>
    [Transaction(TransactionMode.Manual)]
    [Regeneration(RegenerationOption.Manual)]
    [RequiresProduct("STR")]
    public class ColumnRebarCommand : CommandBase
    {
        protected override string CommandId => "STR.ColumnRebar";

        protected override Result ExecuteCommand(
            ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            // Placeholder for the real "column rebar layout" logic.
            // TODO(Windows dev): implement against the active document / selection.

            TaskDialog.Show("STR — Bố trí thép cột",
                "License bộ môn Kết cấu (STR) hợp lệ. Lệnh bố trí thép cột sẽ chạy ở đây.");
            return Result.Succeeded;
        }
    }
}
