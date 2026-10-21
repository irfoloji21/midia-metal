<?php

namespace Database\Seeders;

use App\Models\Service;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ServiceDetailCopySeeder extends Seeder
{
    public function run(): void
    {
        // Original copy for the four confirmed services. Research references:
        // https://www.commercialkitchencompany.co.uk/canopysurvey
        // https://www.pmjkitchenventilation.co.uk/commercial-kitchen-extraction-canopies
        // https://www.hygienaclad.co.uk/stainless-steel-wall-cladding
        // https://www.samsfabrications.co.uk/commercial-catering-equipment/
        // Provider-specific accreditations, guarantees and additional services are excluded.
        $details = [
            'ventilation-systems' => [
                'content' => <<<'HTML'
<h2>Extraction designed around your kitchen</h2>
<p>A kitchen ventilation system needs to suit the cooking equipment, the available space and the route through the building. Midia M Metal designs and installs commercial kitchen extraction systems that bring the canopy, ductwork and fan together as a coordinated installation.</p>
<p>We review the cooking layout and site measurements before planning the system. This establishes the position of the equipment, the ductwork route and access for future cleaning and maintenance.</p>
<h2>From site survey to commissioning</h2>
<p>Our work covers ductwork design and fabrication, fan installation and the connections to the canopy. Once the components are installed, commissioning checks the operation of the complete system.</p>
<h2>Planning your ventilation project</h2>
<p>For a new installation, send us a kitchen plan, approximate dimensions and a list of the cooking equipment. For work on an existing system, photographs of the canopy, ductwork and fan help us understand the current arrangement. These details provide a starting point for reviewing the work and preparing a quotation.</p>
HTML,
                'features' => [
                    'Site surveys and kitchen layout reviews',
                    'Ductwork design and fabrication',
                    'Kitchen extraction fan installation',
                    'System installation and commissioning',
                ],
            ],
            'canopy-installation' => [
                'content' => <<<'HTML'
<h2>Canopies matched to the cooking area</h2>
<p>An extraction canopy collects heat, steam and cooking vapours above the cooking equipment. Its dimensions and position need to work with both the cooking line and the wider extraction system. We supply and install stainless steel canopies sized to the requirements of your kitchen.</p>
<p>Our team reviews the equipment layout, available height and ductwork connection before confirming the canopy specification. We also consider access to filters and the surfaces that require regular cleaning.</p>
<h2>Fabrication, fitting and testing</h2>
<p>We manufacture canopies to agreed dimensions and coordinate the fitting with the kitchen layout. The installation brings the canopy and its extraction connections together, followed by system balancing and testing. Accurate positioning and a considered connection to the ductwork are central to the finished installation.</p>
<h2>Information for your quotation</h2>
<p>Send the cooking line dimensions, ceiling height and details of the appliances beneath the proposed canopy. Photographs or drawings are useful for showing the space and nearby services. For a replacement canopy, include the dimensions of the existing unit and photographs of its ductwork connection.</p>
HTML,
                'features' => [
                    'Canopy measurements and specification',
                    'Bespoke stainless steel canopy fabrication',
                    'Supply and on-site installation',
                    'System balancing and testing',
                ],
            ],
            'wall-cladding' => [
                'content' => <<<'HTML'
<h2>Stainless steel surfaces for working kitchens</h2>
<p>Stainless steel wall cladding provides a durable, wipeable surface around cooking, preparation and washing areas. It protects the wall from everyday splashes and gives the workspace a consistent finish that supports routine cleaning.</p>
<p>Midia M Metal fabricates and installs wall panels to suit the dimensions of the kitchen. The panel layout takes account of existing equipment, corners and service points, so the cladding fits the space as a complete installation.</p>
<h2>Panels made to fit the site</h2>
<p>We review the area to be covered and agree the panel dimensions and finish before fabrication. Edges, joints and openings are planned around the wall layout, including the positions of sockets, pipework and other fittings. This preparation helps achieve accurate alignment when the panels are installed.</p>
<h2>From measurements to final fitting</h2>
<p>Our team handles panel fabrication, on-site fitting and finishing. To request a quotation, provide the width and height of each wall section, photographs of the area and details of any equipment or services the panels need to fit around. Include your preferred finish or a photograph of existing cladding that the new work will sit alongside.</p>
HTML,
                'features' => [
                    'Wall measurements and panel layout',
                    'Stainless steel panel fabrication',
                    'Fitting around corners and existing services',
                    'On-site installation and finishing',
                ],
            ],
            'custom-fabrication' => [
                'content' => <<<'HTML'
<h2>Kitchen equipment made to your dimensions</h2>
<p>The position and dimensions of kitchen equipment affect how the space works. Our bespoke fabrication service produces stainless steel tables, sinks and canopies to suit the available room, surrounding equipment and intended use.</p>
<p>We work from drawings and measurements to establish the size, arrangement and finish of each piece. For equipment that needs to fit an existing kitchen, we review the surrounding space and the points where the new metalwork will meet other surfaces or fittings.</p>
<h2>From specification to finished metalwork</h2>
<p>Materials, dimensions and construction details are agreed before fabrication. Our workshop work includes cutting, forming, welding and finishing, followed by checks against the specification. Attention to joints, edges and surface finish helps create equipment suited to everyday kitchen use and cleaning.</p>
<h2>Preparing a fabrication enquiry</h2>
<p>Provide the required length, width and height, together with a drawing or photographs of the installation area. Describe how the piece will be used and identify any essential openings, connections or clearances. Include a preferred finish where one has been selected. This information allows us to review the fabrication work and prepare a quotation for the specified item.</p>
HTML,
                'features' => [
                    'Review of drawings, dimensions and finishes',
                    'Bespoke stainless steel tables, sinks and canopies',
                    'Stainless steel fabrication and welding',
                    'Finishing and specification checks',
                ],
            ],
        ];

        // Apply explicitly without changing accepted titles, excerpts or publication status.
        DB::transaction(function () use ($details) {
            foreach ($details as $slug => $values) {
                Service::where('slug', $slug)->firstOrFail()->update($values);
            }
        });
    }
}
