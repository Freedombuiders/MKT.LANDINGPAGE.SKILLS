using System;

namespace RevitLicense.License
{
    /// <summary>
    /// Declares which discipline/product a command requires, e.g.
    /// [RequiresProduct("ARC")]. Read reflectively by CommandBase as a secondary
    /// source for the required product (the primary source is the command-id ->
    /// product registry in LicenseClient).
    /// </summary>
    [AttributeUsage(AttributeTargets.Class, Inherited = true, AllowMultiple = false)]
    public sealed class RequiresProductAttribute : Attribute
    {
        public string Product { get; }

        public RequiresProductAttribute(string product)
        {
            Product = product;
        }
    }
}
